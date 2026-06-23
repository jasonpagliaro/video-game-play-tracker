import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm";

import {
  appSettings,
  games,
  importBatches,
  steamAccounts,
  statusHistory,
  syncRuns,
  type games as gamesTable,
} from "@/db/schema";
import {
  DEFAULT_ACTIVE_ROTATION_COUNT,
  DEFAULT_CHECKIN_INTERVAL_DAYS,
  DEFAULT_PARKED_REASSESSMENT_DAYS,
  DEFAULT_QUEUE_WINDOW_SIZE,
  DEFAULT_ROTATION_SKIP_COOLDOWN_DAYS,
  DEFAULT_ROTATION_SKIP_LIMIT,
  DEFAULT_SLOT_WEIGHTS,
  OPEN_ENDED_COMPLETION_TYPES,
  type BacklogSlot,
  type CompletionType,
  type GameStatus,
  type PersonalInterest,
} from "@/lib/backlog/constants";
import {
  filterQueueEligibleCandidates,
  insertGamesWithCategoryBalance,
  reorderQueueByCommand,
  rebalanceQueue as rebalanceQueueLogic,
  sortQueueByPreset,
  type QueueCommand,
  type QueueSortPreset,
} from "@/lib/backlog/queue";
import { parseSteamCsv } from "@/lib/backlog/csv";
import { calculatePriorityScore, inferBacklogSlot, inferCompletionType } from "@/lib/backlog/inference";
import { normalizeTitle } from "@/lib/backlog/normalize";
import {
  buildAddToRotationPatch,
  buildParkForLaterPatch,
  buildReturnFromParkedPatch,
  buildRotationSkipPatch,
  buildWontCompletePatch,
  getRotationFillCandidates,
  isRotationFillCandidate,
} from "@/lib/backlog/rotation-fill";
import { transitionGameStatus } from "@/lib/backlog/status";
import type { GameVisibilitySnapshot } from "@/lib/backlog/autosave";
import type {
  AppSettings,
  Game,
  GameStatusHistoryEntry,
  GameSummary,
  ParsedCsvGame,
  QueueCandidate,
} from "@/lib/backlog/types";
import { isDatabaseConfigured } from "@/lib/env";
import { fetchSteamStoreMetadataForAppIds } from "@/lib/steam/client";
import type { SteamLibraryGame, SteamLibrarySyncData } from "@/lib/steam/library";
import type { SteamStoreMetadata } from "@/lib/steam/metadata";
import { isSteamRefreshDue, validateSteamSyncInterval } from "@/lib/steam/auto-refresh";
import { type AppUser, withSystemDb, withUserDb } from "./client";

type GameRow = typeof gamesTable.$inferSelect;
type Tx = Parameters<Parameters<ReturnType<typeof import("./client").getDb>["transaction"]>[0]>[0];

export type ImportDecision = "unqueued" | "queue" | "park" | "wont_complete" | "review";

type QueueMoveCommand = Exclude<QueueCommand, "add_to_queue" | "remove_from_queue">;

export type ImportApplyResult = {
  batchId: string | null;
  addedCount: number;
  updatedCount: number;
  skippedCount: number;
  rowCount: number;
};

export type SteamImportApplyResult = ImportApplyResult & {
  steamid64: string;
  displayName: string | null;
  profileUrl: string | null;
  syncRunId: string | null;
  missingCount: number;
  queuedCount: number;
  metadataEnrichedCount: number;
  metadataFailedCount: number;
};

export type DueSteamAutoRefreshAccount = {
  user: AppUser;
  steamAccountId: string;
  steamid64: string;
  displayName: string | null;
  lastLibrarySyncAt: Date | null;
  intervalHours: number;
  autoQueueNewImports: boolean;
};

export type DueSteamAutoRefreshAccountsResult = {
  checkedCount: number;
  dueAccounts: DueSteamAutoRefreshAccount[];
};

export function defaultSettings(userId?: string): AppSettings {
  return {
    userId,
    maxActiveRotationCount: DEFAULT_ACTIVE_ROTATION_COUNT,
    maxInstalledCount: null,
    checkinIntervalDays: DEFAULT_CHECKIN_INTERVAL_DAYS,
    checkinIntervalHoursPlayed: 2,
    completedSetsInstalledFalse: true,
    dnfSetsInstalledFalse: true,
    parkedSetsInstalledFalse: true,
    inProgressSetsInstalledTrue: true,
    inProgressAddsToRotationWhenSpace: true,
    autoQueueNewImports: false,
    protectManualFieldsFromSync: true,
    steamAutoSyncEnabled: true,
    steamSyncIntervalDays: 1,
    steamSyncIntervalHours: 0,
    queueSlidingWindowSize: DEFAULT_QUEUE_WINDOW_SIZE,
    rotationSkipCooldownDays: DEFAULT_ROTATION_SKIP_COOLDOWN_DAYS,
    rotationSkipLimit: DEFAULT_ROTATION_SKIP_LIMIT,
    parkedReassessmentDays: DEFAULT_PARKED_REASSESSMENT_DAYS,
    slotWeights: DEFAULT_SLOT_WEIGHTS,
  };
}

export async function getSettings(user: AppUser): Promise<AppSettings> {
  if (!isDatabaseConfigured()) return defaultSettings(user.id);
  return withUserDb(user, async (tx) => {
    const existing = await tx.query.appSettings.findFirst({
      where: eq(appSettings.userId, user.id),
    });
    if (existing) return mapSettings(existing);
    const [created] = await tx
      .insert(appSettings)
      .values({ userId: user.id, slotWeights: DEFAULT_SLOT_WEIGHTS })
      .returning();
    return mapSettings(created);
  });
}

export async function getGames(user: AppUser): Promise<GameSummary[]> {
  if (!isDatabaseConfigured()) return [];
  return withUserDb(user, async (tx) => {
    const rows = await tx.query.games.findMany({
      where: eq(games.userId, user.id),
      orderBy: [asc(games.queueRank), asc(games.title)],
    });
    return rows.map(mapGameSummary);
  });
}

export async function getFullGames(user: AppUser): Promise<Game[]> {
  if (!isDatabaseConfigured()) return [];
  return withUserDb(user, async (tx) => {
    const rows = await tx.query.games.findMany({
      where: eq(games.userId, user.id),
      orderBy: [asc(games.queueRank), asc(games.title)],
    });
    return rows.map(mapGame);
  });
}

export async function getGame(user: AppUser, id: string): Promise<Game | null> {
  if (!isDatabaseConfigured()) return null;
  return withUserDb(user, async (tx) => {
    const row = await tx.query.games.findFirst({
      where: and(eq(games.userId, user.id), eq(games.id, id)),
    });
    return row ? mapGame(row) : null;
  });
}

export async function getGameStatusHistory(user: AppUser, gameId: string): Promise<GameStatusHistoryEntry[]> {
  if (!isDatabaseConfigured()) return [];
  return withUserDb(user, async (tx) => {
    const rows = await tx
      .select()
      .from(statusHistory)
      .where(and(eq(statusHistory.userId, user.id), eq(statusHistory.gameId, gameId)))
      .orderBy(desc(statusHistory.changedAt));
    return rows.map(mapStatusHistoryEntry);
  });
}

export async function getGameVisibilitySnapshot(user: AppUser, id: string): Promise<GameVisibilitySnapshot | null> {
  if (!isDatabaseConfigured()) return null;
  return withUserDb(user, async (tx) => {
    const row = await tx.query.games.findFirst({
      where: and(eq(games.userId, user.id), eq(games.id, id)),
    });
    return row ? mapGameVisibilitySnapshot(row) : null;
  });
}

export async function updateGameStatus(input: {
  user: AppUser;
  gameId: string;
  newStatus: GameStatus;
  dnfReason?: string | null;
  replacementGameId?: string | null;
}) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(input.user, async (tx) => {
    const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, input.user.id) });
    const settings = settingsRow ? mapSettings(settingsRow) : defaultSettings(input.user.id);
    const game = await tx.query.games.findFirst({
      where: and(eq(games.userId, input.user.id), eq(games.id, input.gameId)),
    });
    if (!game) throw new Error("Game not found.");
    const activeCount = await getActiveCount(tx, input.user.id);
    const patch = transitionGameStatus({
      game: mapGame(game),
      newStatus: input.newStatus,
      settings,
      activeCount,
      dnfReason: input.dnfReason,
    });
    if (patch.needsReplacement && !input.replacementGameId) {
      throw new Error("Rotation is full. Choose a game to remove from rotation first.");
    }
    if (patch.needsReplacement && input.replacementGameId) {
      await tx
        .update(games)
        .set({ currentRotation: false, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), eq(games.id, input.replacementGameId)));
      patch.currentRotation = true;
    }
    delete patch.needsReplacement;
    if (patch.currentRotation) {
      patch.queueRank = null;
      patch.queueLocked = false;
    }
    await tx
      .update(games)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(games.userId, input.user.id), eq(games.id, input.gameId)));
    await tx.insert(statusHistory).values({
      userId: input.user.id,
      gameId: input.gameId,
      previousStatus: game.status,
      newStatus: input.newStatus,
      notes: input.dnfReason ?? null,
    });
    if (game.queueRank != null || patch.queueRank != null) await rebalanceQueueRanks(tx, input.user.id);
  });
}

export async function setInstalled(user: AppUser, gameId: string, installed: boolean, nextStatus?: GameStatus) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const game = await tx.query.games.findFirst({ where: and(eq(games.userId, user.id), eq(games.id, gameId)) });
    if (!game) throw new Error("Game not found.");
    if (!installed && game.status === "installed" && !nextStatus) {
      throw new Error("Choose Not Started or Parked before uninstalling an Installed game.");
    }
    await tx
      .update(games)
      .set({ installed, status: nextStatus ?? game.status, updatedAt: new Date() })
      .where(and(eq(games.userId, user.id), eq(games.id, gameId)));
  });
}

export async function setCurrentRotation(user: AppUser, gameId: string, currentRotation: boolean, replacementGameId?: string) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const target = await tx.query.games.findFirst({ where: and(eq(games.userId, user.id), eq(games.id, gameId)) });
    if (!target) throw new Error("Game not found.");
    if (currentRotation) {
      const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, user.id) });
      const max = settingsRow?.maxActiveRotationCount ?? DEFAULT_ACTIVE_ROTATION_COUNT;
      const activeCount = await getActiveCount(tx, user.id);
      if (!target.currentRotation && activeCount >= max) {
        if (!replacementGameId) throw new Error("Rotation is full. Choose a replacement first.");
        await tx
          .update(games)
          .set({ currentRotation: false, updatedAt: new Date() })
          .where(and(eq(games.userId, user.id), eq(games.id, replacementGameId)));
      }
    }
    await tx
      .update(games)
      .set({
        currentRotation,
        installed: currentRotation ? true : undefined,
        queueRank: currentRotation ? null : undefined,
        queueLocked: currentRotation ? false : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(games.userId, user.id), eq(games.id, gameId)));
    if (target.queueRank != null && currentRotation) await rebalanceQueueRanks(tx, user.id);
  });
}

export async function updateGameFields(
  user: AppUser,
  gameId: string,
  fields: Partial<{
    backlogSlot: BacklogSlot;
    completionType: CompletionType;
    personalInterest: PersonalInterest;
    queueLocked: boolean;
    notes: string | null;
    dnfReason: string | null;
  }>,
) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    await tx
      .update(games)
      .set({
        ...fields,
        manualBacklogSlot: fields.backlogSlot ? true : undefined,
        manualCompletionType: fields.completionType ? true : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(games.userId, user.id), eq(games.id, gameId)));
    if (fields.backlogSlot || fields.completionType || fields.personalInterest || fields.queueLocked != null) {
      await rebalanceQueueRanks(tx, user.id);
    }
  });
}

export async function bulkUpdateGames(input: {
  user: AppUser;
  gameIds: string[];
  action: string;
  status?: GameStatus;
  backlogSlot?: BacklogSlot;
  completionType?: CompletionType;
  personalInterest?: PersonalInterest;
}) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  const gameIds = [...new Set(input.gameIds.filter(Boolean))];
  if (gameIds.length === 0) return;
  if (input.action === "reclassify") {
    await reclassifyGames(input.user, gameIds);
    return;
  }

  return withUserDb(input.user, async (tx) => {
    const selected = await tx.query.games.findMany({
      where: and(eq(games.userId, input.user.id), inArray(games.id, gameIds)),
      orderBy: [asc(games.title)],
    });

    if (input.action === "set_status" && input.status) {
      const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, input.user.id) });
      const settings = settingsRow ? mapSettings(settingsRow) : defaultSettings(input.user.id);
      for (const game of selected) {
        const patch = transitionGameStatus({
          game: mapGame(game),
          newStatus: input.status,
          settings,
          activeCount: await getActiveCount(tx, input.user.id),
          dnfReason: input.status === "dnf" ? game.dnfReason ?? "Bulk DNF decision" : undefined,
        });
        if (patch.needsReplacement) {
          delete patch.needsReplacement;
          patch.currentRotation = false;
        }
        await tx
          .update(games)
          .set({ ...patch, updatedAt: new Date() })
          .where(and(eq(games.userId, input.user.id), eq(games.id, game.id)));
        await tx.insert(statusHistory).values({
          userId: input.user.id,
          gameId: game.id,
          previousStatus: game.status,
          newStatus: input.status,
          notes: "Bulk status update",
        });
      }
      if (selected.some((game) => game.queueRank != null)) await rebalanceQueueRanks(tx, input.user.id);
      return;
    }

    if (input.action === "set_slot" && input.backlogSlot) {
      await tx
        .update(games)
        .set({ backlogSlot: input.backlogSlot, manualBacklogSlot: true, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      await rebalanceQueueRanks(tx, input.user.id);
      return;
    }

    if (input.action === "set_completion_type" && input.completionType) {
      await tx
        .update(games)
        .set({ completionType: input.completionType, manualCompletionType: true, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      await rebalanceQueueRanks(tx, input.user.id);
      return;
    }

    if (input.action === "set_interest" && input.personalInterest) {
      await tx
        .update(games)
        .set({ personalInterest: input.personalInterest, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      await rebalanceQueueRanks(tx, input.user.id);
      return;
    }

    if (input.action === "park") {
      await tx
        .update(games)
        .set({
          status: "parked",
          currentRotation: false,
          installed: false,
          queueRank: null,
          queueLocked: false,
          updatedAt: new Date(),
        })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      await rebalanceQueueRanks(tx, input.user.id);
      return;
    }

    if (input.action === "wont_complete") {
      await tx
        .update(games)
        .set({
          status: "wont_complete",
          currentRotation: false,
          installed: false,
          queueRank: null,
          queueLocked: false,
          updatedAt: new Date(),
        })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      await rebalanceQueueRanks(tx, input.user.id);
      return;
    }

    if (input.action === "remove_rotation") {
      await tx
        .update(games)
        .set({ currentRotation: false, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      return;
    }

    if (input.action === "mark_ignored") {
      await tx
        .update(games)
        .set({ syncState: "ignored", currentRotation: false, queueRank: null, queueLocked: false, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      await rebalanceQueueRanks(tx, input.user.id);
      return;
    }

    if (input.action === "recalculate_priority") {
      for (const game of selected) {
        await tx
          .update(games)
          .set({
            priorityScore: calculatePriorityScore({
              personalInterest: game.personalInterest,
              playtimeMinutes: game.playtimeMinutes,
              steamReviewScore: game.steamReviewScore,
              estimatedHours: game.estimatedHours,
              completionType: game.completionType,
              backlogSlot: game.backlogSlot,
            }),
            updatedAt: new Date(),
          })
          .where(and(eq(games.userId, input.user.id), eq(games.id, game.id)));
      }
      await rebalanceQueueRanks(tx, input.user.id);
      return;
    }

    if (input.action === "add_to_queue" || input.action === "rebalance_selected") {
      const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, input.user.id) });
      const existingQueue = (
        await tx.query.games.findMany({
          where: and(eq(games.userId, input.user.id), sql`${games.queueRank} is not null`),
          orderBy: [asc(games.queueRank)],
        })
      )
        .filter((game) => !gameIds.includes(game.id))
        .map(mapQueueCandidate);
      const selectedCandidates = filterQueueEligibleCandidates(selected.map(mapQueueCandidate));
      const { queue } = insertGamesWithCategoryBalance(existingQueue, selectedCandidates, {
        windowSize: settingsRow?.queueSlidingWindowSize ?? DEFAULT_QUEUE_WINDOW_SIZE,
      });
      await persistQueueRanks(tx, input.user.id, queue);
    }
  });
}

async function reclassifyGames(user: AppUser, gameIds: string[]) {
  const selected = await withUserDb(user, async (tx) =>
    tx.query.games.findMany({
      where: and(eq(games.userId, user.id), inArray(games.id, gameIds)),
      orderBy: [asc(games.title)],
    }),
  );
  const metadata = await fetchSteamStoreMetadataForAppIds(
    selected.map((game) => game.steamAppId).filter((appId): appId is number => appId != null),
  );

  await withUserDb(user, async (tx) => {
    for (const game of selected) {
      const patch = buildReclassificationPatch(game, metadata.metadataByAppId.get(game.steamAppId ?? 0));
      await tx
        .update(games)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(games.userId, user.id), eq(games.id, game.id)));
    }
    if (selected.some((game) => game.queueRank != null)) await rebalanceQueueRanks(tx, user.id);
  });
}

export async function updateSettings(user: AppUser, next: Partial<AppSettings>) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const currentActiveCount = await getActiveCount(tx, user.id);
    const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, user.id) });
    const currentSettings = settingsRow ? mapSettings(settingsRow) : defaultSettings(user.id);
    const mergedSettings = { ...currentSettings, ...next };
    const steamIntervalError = validateSteamSyncInterval(
      mergedSettings.steamSyncIntervalDays,
      mergedSettings.steamSyncIntervalHours,
    );
    if (steamIntervalError) throw new Error(steamIntervalError);
    if (
      typeof next.maxActiveRotationCount === "number" &&
      next.maxActiveRotationCount < currentActiveCount
    ) {
      throw new Error(`Cannot lower active limit below the current ${currentActiveCount} active games.`);
    }
    await tx
      .insert(appSettings)
      .values({ userId: user.id, ...settingsToDb(next) })
      .onConflictDoUpdate({
        target: appSettings.userId,
        set: { ...settingsToDb(next), updatedAt: new Date() },
      });
  });
}

export async function applyCsvImport(input: {
  user: AppUser;
  filename: string;
  csvText: string;
  decision: ImportDecision;
}): Promise<ImportApplyResult> {
  const preview = parseSteamCsv(input.csvText, input.filename, Number.MAX_SAFE_INTEGER);
  if (!isDatabaseConfigured()) {
    return {
      batchId: null,
      addedCount: preview.validCount,
      updatedCount: 0,
      skippedCount: preview.skippedCount,
      rowCount: preview.rowCount,
    };
  }

  return withUserDb(input.user, async (tx) => {
    let addedCount = 0;
    let updatedCount = 0;
    const importedIds: string[] = [];
    for (const row of preview.rows) {
      if (!row.valid || !row.normalized) continue;
      const existing = await findExistingGame(tx, input.user.id, row.normalized);
      const status = statusForImportDecision(input.decision, row.normalized);
      if (existing) {
        const [updated] = await tx
          .update(games)
          .set({
            title: row.normalized.title,
            playtimeMinutes: row.normalized.playtimeMinutes,
            lastPlayed: row.normalized.lastPlayed,
            steamReviewScore: row.normalized.steamReviewScore,
            steamReviewSummary: row.normalized.steamReviewSummary,
            releaseYear: row.normalized.releaseYear,
            genres: row.normalized.genres,
            tags: row.normalized.tags,
            achievementsUnlocked: row.normalized.achievementsUnlocked,
            achievementsTotal: row.normalized.achievementsTotal,
            achievementPercent: row.normalized.achievementPercent,
            ...resolveSyncedClassification(existing, row.normalized),
            priorityScore: row.normalized.priorityScore,
            syncState: existing.syncState === "ignored" ? "ignored" : "imported",
            rawImportMetadata: row.normalized.rawImportMetadata,
            updatedAt: new Date(),
          })
          .where(and(eq(games.userId, input.user.id), eq(games.id, existing.id)))
          .returning();
        updatedCount += 1;
        if (updated) importedIds.push(updated.id);
      } else {
        const [created] = await tx
          .insert(games)
          .values({
            userId: input.user.id,
            title: row.normalized.title,
            normalizedTitle: normalizeTitle(row.normalized.title),
            steamAppId: row.normalized.steamAppId,
            source: "Steam",
            playtimeMinutes: row.normalized.playtimeMinutes,
            lastPlayed: row.normalized.lastPlayed,
            steamReviewScore: row.normalized.steamReviewScore,
            steamReviewSummary: row.normalized.steamReviewSummary,
            releaseYear: row.normalized.releaseYear,
            genres: row.normalized.genres,
            tags: row.normalized.tags,
            achievementsUnlocked: row.normalized.achievementsUnlocked,
            achievementsTotal: row.normalized.achievementsTotal,
            achievementPercent: row.normalized.achievementPercent,
            completionType: row.normalized.completionType,
            backlogSlot: row.normalized.backlogSlot,
            priorityScore: row.normalized.priorityScore,
            status,
            syncState: "imported",
            rawImportMetadata: row.normalized.rawImportMetadata,
          })
          .returning();
        addedCount += 1;
        importedIds.push(created.id);
      }
    }

    if (input.decision === "queue" && importedIds.length > 0) {
      await insertImportedGamesIntoQueue(tx, input.user.id, importedIds);
    }

    const [batch] = await tx
      .insert(importBatches)
      .values({
        userId: input.user.id,
        filename: input.filename,
        rowCount: preview.rowCount,
        addedCount,
        updatedCount,
        skippedCount: preview.skippedCount,
        notes: `Decision: ${input.decision}`,
      })
      .returning();

    return {
      batchId: batch.id,
      addedCount,
      updatedCount,
      skippedCount: preview.skippedCount,
      rowCount: preview.rowCount,
    };
  });
}

export async function applySteamLibraryImport(input: {
  user: AppUser;
  library: SteamLibrarySyncData;
  decision: ImportDecision;
}): Promise<SteamImportApplyResult> {
  if (!isDatabaseConfigured()) {
    return {
      batchId: null,
      syncRunId: null,
      steamid64: input.library.account.steamid64,
      displayName: input.library.account.displayName,
      profileUrl: input.library.account.profileUrl,
      addedCount: input.library.validCount,
      updatedCount: 0,
      missingCount: 0,
      queuedCount: input.decision === "queue" ? input.library.validCount : 0,
      skippedCount: input.library.skippedCount,
      rowCount: input.library.rowCount,
      metadataEnrichedCount: input.library.metadataEnrichedCount,
      metadataFailedCount: input.library.metadataFailedCount,
    };
  }

  return withUserDb(input.user, async (tx) => {
    const now = new Date();
    const steamAccount = await upsertSteamAccount(tx, input.user.id, input.library.account, now);
    let addedCount = 0;
    let updatedCount = 0;
    const importedIds: string[] = [];

    for (const steamGame of input.library.games) {
      const existing = await findExistingGameBySteamAppId(tx, input.user.id, steamGame.steamAppId);
      if (existing) {
        const classification = resolveSyncedClassification(existing, steamGame);
        const [updated] = await tx
          .update(games)
          .set({
            title: steamGame.title,
            normalizedTitle: normalizeTitle(steamGame.title),
            steamid64Owner: steamGame.steamid64Owner,
            playtimeMinutes: steamGame.playtimeMinutes,
            playtimeWindowsMinutes: steamGame.playtimeWindowsMinutes,
            playtimeMacMinutes: steamGame.playtimeMacMinutes,
            playtimeLinuxMinutes: steamGame.playtimeLinuxMinutes,
            lastPlayed: steamGame.lastPlayed,
            steamReviewScore: steamGame.steamReviewScore,
            releaseYear: steamGame.releaseYear,
            genres: steamGame.genres,
            tags: steamGame.tags,
            ...classification,
            priorityScore: calculatePriorityScore({
              personalInterest: existing.personalInterest,
              playtimeMinutes: steamGame.playtimeMinutes,
              steamReviewScore: steamGame.steamReviewScore,
              estimatedHours: existing.estimatedHours,
              completionType: classification.completionType,
              backlogSlot: classification.backlogSlot,
            }),
            syncState: existing.syncState === "ignored" ? "ignored" : "synced",
            lastSeenInSyncAt: now,
            lastSyncedAt: now,
            rawImportMetadata: steamGame.rawImportMetadata,
            updatedAt: now,
          })
          .where(and(eq(games.userId, input.user.id), eq(games.id, existing.id)))
          .returning();
        updatedCount += 1;
        if (updated) importedIds.push(updated.id);
      } else {
        const [created] = await tx
          .insert(games)
          .values({
            userId: input.user.id,
            title: steamGame.title,
            normalizedTitle: normalizeTitle(steamGame.title),
            steamAppId: steamGame.steamAppId,
            steamid64Owner: steamGame.steamid64Owner,
            source: "Steam",
            playtimeMinutes: steamGame.playtimeMinutes,
            playtimeWindowsMinutes: steamGame.playtimeWindowsMinutes,
            playtimeMacMinutes: steamGame.playtimeMacMinutes,
            playtimeLinuxMinutes: steamGame.playtimeLinuxMinutes,
            lastPlayed: steamGame.lastPlayed,
            steamReviewScore: steamGame.steamReviewScore,
            releaseYear: steamGame.releaseYear,
            genres: steamGame.genres,
            tags: steamGame.tags,
            completionType: steamGame.completionType,
            backlogSlot: steamGame.backlogSlot,
            priorityScore: steamGame.priorityScore,
            status: statusForImportDecision(input.decision, steamGame),
            syncState: "synced",
            firstSeenAt: now,
            lastSeenInSyncAt: now,
            lastSyncedAt: now,
            rawImportMetadata: steamGame.rawImportMetadata,
          })
          .returning();
        addedCount += 1;
        importedIds.push(created.id);
      }
    }

    const missingCount = input.library.games.length > 0
      ? await markMissingFromLatestSteamSync(tx, input.user.id, input.library.account.steamid64, input.library.games, now)
      : 0;
    const queuedCount = input.decision === "queue" && importedIds.length > 0
      ? await insertImportedGamesIntoQueue(tx, input.user.id, importedIds)
      : 0;

    await tx
      .update(steamAccounts)
      .set({ lastLibrarySyncAt: now, updatedAt: now })
      .where(and(eq(steamAccounts.userId, input.user.id), eq(steamAccounts.id, steamAccount.id)));

    const [syncRun] = await tx
      .insert(syncRuns)
      .values({
        userId: input.user.id,
        steamAccountId: steamAccount.id,
        syncType: "library",
        completedAt: now,
        status: "success",
        addedCount,
        updatedCount,
        missingCount,
        notes: `Decision: ${input.decision}; source: Steam Web API library sync; metadata enriched: ${input.library.metadataEnrichedCount}; metadata failed: ${input.library.metadataFailedCount}`,
      })
      .returning();

    return {
      batchId: null,
      syncRunId: syncRun.id,
      steamid64: input.library.account.steamid64,
      displayName: input.library.account.displayName,
      profileUrl: input.library.account.profileUrl,
      addedCount,
      updatedCount,
      missingCount,
      queuedCount,
      skippedCount: input.library.skippedCount,
      rowCount: input.library.rowCount,
      metadataEnrichedCount: input.library.metadataEnrichedCount,
      metadataFailedCount: input.library.metadataFailedCount,
    };
  });
}

export async function getDueSteamAutoRefreshAccounts({
  now = new Date(),
  limit = 5,
}: {
  now?: Date;
  limit?: number;
} = {}): Promise<DueSteamAutoRefreshAccountsResult> {
  if (!isDatabaseConfigured()) return { checkedCount: 0, dueAccounts: [] };

  return withSystemDb(async (tx) => {
    const rows = await tx
      .select({
        steamAccountId: steamAccounts.id,
        userId: steamAccounts.userId,
        displayName: steamAccounts.displayName,
        steamid64: steamAccounts.steamid64,
        lastLibrarySyncAt: steamAccounts.lastLibrarySyncAt,
        autoQueueNewImports: appSettings.autoQueueNewImports,
        steamAutoSyncEnabled: appSettings.steamAutoSyncEnabled,
        steamSyncIntervalDays: appSettings.steamSyncIntervalDays,
        steamSyncIntervalHours: appSettings.steamSyncIntervalHours,
      })
      .from(steamAccounts)
      .innerJoin(appSettings, eq(steamAccounts.userId, appSettings.userId))
      .where(eq(steamAccounts.syncEnabled, true));

    const dueAccounts = rows
      .filter((row) => isSteamRefreshDue(row, now))
      .sort((a, b) => {
        const aTime = a.lastLibrarySyncAt?.getTime() ?? 0;
        const bTime = b.lastLibrarySyncAt?.getTime() ?? 0;
        return aTime - bTime;
      })
      .slice(0, Math.max(1, limit))
      .map((row) => ({
        user: { id: row.userId, email: null },
        steamAccountId: row.steamAccountId,
        steamid64: row.steamid64 ?? "",
        displayName: row.displayName,
        lastLibrarySyncAt: row.lastLibrarySyncAt,
        intervalHours: row.steamSyncIntervalDays * 24 + row.steamSyncIntervalHours,
        autoQueueNewImports: row.autoQueueNewImports,
      }));

    return {
      checkedCount: rows.length,
      dueAccounts,
    };
  });
}

export async function recordSteamAutoRefreshFailure(input: {
  user: AppUser;
  steamAccountId: string;
  errorMessage: string;
}) {
  if (!isDatabaseConfigured()) return;

  await withUserDb(input.user, async (tx) => {
    await tx.insert(syncRuns).values({
      userId: input.user.id,
      steamAccountId: input.steamAccountId,
      syncType: "library",
      completedAt: new Date(),
      status: "failed",
      errorMessage: input.errorMessage,
      notes: "Source: scheduled Steam auto-refresh",
    });
  });
}

export async function rebalanceUserQueue(user: AppUser) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => rebalanceQueueRanks(tx, user.id));
}

export async function applyQueueCommand(
  user: AppUser,
  input: { gameId: string; command: QueueCommand; targetGameId?: string },
) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const target = await tx.query.games.findFirst({
      where: and(eq(games.userId, user.id), eq(games.id, input.gameId)),
    });
    if (!target) throw new Error("Game not found.");

    if (input.command === "remove_from_queue") {
      await tx
        .update(games)
        .set({ queueRank: null, queueLocked: false, updatedAt: new Date() })
        .where(and(eq(games.userId, user.id), eq(games.id, input.gameId)));
      await rebalanceQueueRanks(tx, user.id);
      return;
    }

    if (input.command === "add_to_queue") {
      if (target.queueRank != null) return;
      const candidate = mapQueueCandidate(target);
      if (!filterQueueEligibleCandidates([candidate]).length) {
        throw new Error("This game is not eligible for the queue.");
      }
      const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, user.id) });
      const existingQueue = (
        await tx.query.games.findMany({
          where: and(eq(games.userId, user.id), sql`${games.queueRank} is not null`),
          orderBy: [asc(games.queueRank)],
        })
      ).map(mapQueueCandidate);
      const { queue } = insertGamesWithCategoryBalance(existingQueue, [candidate], {
        windowSize: settingsRow?.queueSlidingWindowSize ?? DEFAULT_QUEUE_WINDOW_SIZE,
      });
      await persistQueueRanks(tx, user.id, queue);
      return;
    }

    if (target.queueRank == null) throw new Error("Only queued games can be moved.");
    if (target.queueLocked) throw new Error("Locked queue items cannot be moved.");

    const queueRows = await tx.query.games.findMany({
      where: and(eq(games.userId, user.id), sql`${games.queueRank} is not null`),
      orderBy: [asc(games.queueRank)],
    });
    if ((input.command === "move_before" || input.command === "move_after") && !input.targetGameId) {
      throw new Error("Choose a target game first.");
    }
    if (input.targetGameId) {
      const moveTarget = queueRows.find((game) => game.id === input.targetGameId);
      if (!moveTarget) throw new Error("Target game is not queued.");
      if (moveTarget.queueLocked) throw new Error("Choose an unlocked target game.");
    }

    const queue = reorderQueueByCommand(queueRows.map(mapQueueCandidate), {
      gameId: input.gameId,
      command: input.command as QueueMoveCommand,
      targetGameId: input.targetGameId,
    });
    await persistQueueRanks(tx, user.id, queue);
  });
}

export async function sortUserQueue(user: AppUser, preset: QueueSortPreset) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, user.id) });
    const queueRows = await tx.query.games.findMany({
      where: and(eq(games.userId, user.id), sql`${games.queueRank} is not null`),
      orderBy: [asc(games.queueRank)],
    });
    const queue = sortQueueByPreset(queueRows.map(mapQueueCandidate), preset, {
      windowSize: settingsRow?.queueSlidingWindowSize ?? DEFAULT_QUEUE_WINDOW_SIZE,
    });
    await persistQueueRanks(tx, user.id, queue);
  });
}

export async function fillRotationFromQueue(user: AppUser) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const settings = await getSettingsForUser(tx, user.id);
    const rows = await tx.query.games.findMany({
      where: eq(games.userId, user.id),
      orderBy: [asc(games.queueRank), asc(games.title)],
    });
    const candidates = getRotationFillCandidates(rows.map(mapGameSummary), settings);
    if (candidates.length === 0) return 0;
    const now = new Date();
    for (const candidate of candidates) {
      await tx
        .update(games)
        .set({ ...buildAddToRotationPatch(), updatedAt: now })
        .where(and(eq(games.userId, user.id), eq(games.id, candidate.id)));
    }
    await rebalanceQueueRanks(tx, user.id);
    return candidates.length;
  });
}

export async function addQueuedGameToRotation(user: AppUser, gameId: string) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const settings = await getSettingsForUser(tx, user.id);
    const activeCount = await getActiveCount(tx, user.id);
    if (activeCount >= settings.maxActiveRotationCount) {
      throw new Error("Rotation is already full.");
    }
    const target = await tx.query.games.findFirst({ where: and(eq(games.userId, user.id), eq(games.id, gameId)) });
    if (!target) throw new Error("Game not found.");
    if (!isRotationFillCandidate(mapGameSummary(target))) {
      throw new Error("This game is not eligible for rotation fill.");
    }
    await tx
      .update(games)
      .set({ ...buildAddToRotationPatch(), updatedAt: new Date() })
      .where(and(eq(games.userId, user.id), eq(games.id, gameId)));
    await rebalanceQueueRanks(tx, user.id);
  });
}

export async function skipRotationSuggestion(user: AppUser, gameId: string) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const settings = await getSettingsForUser(tx, user.id);
    const target = await tx.query.games.findFirst({ where: and(eq(games.userId, user.id), eq(games.id, gameId)) });
    if (!target) throw new Error("Game not found.");
    const candidate = mapGameSummary(target);
    if (!isRotationFillCandidate(candidate)) {
      throw new Error("This game is not available to skip right now.");
    }
    await tx
      .update(games)
      .set({ ...buildRotationSkipPatch(candidate, settings), updatedAt: new Date() })
      .where(and(eq(games.userId, user.id), eq(games.id, gameId)));
  });
}

export async function parkGameForLater(user: AppUser, gameId: string) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const settings = await getSettingsForUser(tx, user.id);
    const target = await tx.query.games.findFirst({ where: and(eq(games.userId, user.id), eq(games.id, gameId)) });
    if (!target) throw new Error("Game not found.");
    const patch = buildParkForLaterPatch(settings);
    await tx
      .update(games)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(games.userId, user.id), eq(games.id, gameId)));
    await insertStatusHistoryIfChanged(tx, user.id, target, "parked", "Parked for later reassessment");
    if (target.queueRank != null) await rebalanceQueueRanks(tx, user.id);
  });
}

export async function returnParkedGameToQueue(user: AppUser, gameId: string) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const target = await tx.query.games.findFirst({ where: and(eq(games.userId, user.id), eq(games.id, gameId)) });
    if (!target) throw new Error("Game not found.");
    if (!target.parkedForLater) throw new Error("Only Parked-for-later games can be returned from this action.");
    const patch = buildReturnFromParkedPatch();
    await tx
      .update(games)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(games.userId, user.id), eq(games.id, gameId)));
    await insertStatusHistoryIfChanged(tx, user.id, target, "not_started", "Returned from Parked for later");
    return insertImportedGamesIntoQueue(tx, user.id, [gameId]);
  });
}

export async function markGameWontCompleteFromSuggestion(user: AppUser, gameId: string) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const target = await tx.query.games.findFirst({ where: and(eq(games.userId, user.id), eq(games.id, gameId)) });
    if (!target) throw new Error("Game not found.");
    await tx
      .update(games)
      .set({ ...buildWontCompletePatch(), updatedAt: new Date() })
      .where(and(eq(games.userId, user.id), eq(games.id, gameId)));
    await insertStatusHistoryIfChanged(tx, user.id, target, "wont_complete", "Marked from rotation suggestion");
    if (target.queueRank != null) await rebalanceQueueRanks(tx, user.id);
  });
}

async function getActiveCount(tx: Tx, userId: string) {
  const result = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(games)
    .where(and(eq(games.userId, userId), eq(games.currentRotation, true)));
  return result[0]?.count ?? 0;
}

async function getSettingsForUser(tx: Tx, userId: string) {
  const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, userId) });
  return settingsRow ? mapSettings(settingsRow) : defaultSettings(userId);
}

async function insertStatusHistoryIfChanged(
  tx: Tx,
  userId: string,
  game: GameRow,
  newStatus: GameStatus,
  notes: string,
) {
  if (game.status === newStatus) return;
  await tx.insert(statusHistory).values({
    userId,
    gameId: game.id,
    previousStatus: game.status,
    newStatus,
    notes,
  });
}

async function findExistingGame(
  tx: Tx,
  userId: string,
  game: ParsedCsvGame,
) {
  if (game.steamAppId != null) {
    const byAppId = await tx.query.games.findFirst({
      where: and(eq(games.userId, userId), eq(games.steamAppId, game.steamAppId)),
    });
    if (byAppId) return byAppId;
  }
  return tx.query.games.findFirst({
    where: and(eq(games.userId, userId), eq(games.normalizedTitle, normalizeTitle(game.title))),
  });
}

async function findExistingGameBySteamAppId(tx: Tx, userId: string, steamAppId: number) {
  return tx.query.games.findFirst({
    where: and(eq(games.userId, userId), eq(games.steamAppId, steamAppId)),
  });
}

async function upsertSteamAccount(
  tx: Tx,
  userId: string,
  account: SteamLibrarySyncData["account"],
  now: Date,
) {
  const existing = await tx.query.steamAccounts.findFirst({
    where: and(eq(steamAccounts.userId, userId), eq(steamAccounts.steamid64, account.steamid64)),
  });
  const values = {
    displayName: account.displayName,
    customProfileId: account.customProfileId,
    steamid64: account.steamid64,
    profileUrl: account.profileUrl,
    apiKeyEncryptedOrEnvReference: "env:STEAM_API_KEY",
    syncEnabled: true,
    updatedAt: now,
  };
  if (existing) {
    const [updated] = await tx
      .update(steamAccounts)
      .set(values)
      .where(and(eq(steamAccounts.userId, userId), eq(steamAccounts.id, existing.id)))
      .returning();
    return updated ?? existing;
  }
  const [created] = await tx
    .insert(steamAccounts)
    .values({
      userId,
      ...values,
    })
    .returning();
  if (!created) throw new Error("Steam account could not be saved.");
  return created;
}

async function markMissingFromLatestSteamSync(
  tx: Tx,
  userId: string,
  steamid64: string,
  syncedGames: SteamLibraryGame[],
  now: Date,
) {
  const syncedAppIds = syncedGames.map((game) => game.steamAppId);
  if (syncedAppIds.length === 0) return 0;
  const missingRows = await tx
    .update(games)
    .set({
      syncState: "missing_from_latest_sync",
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(games.userId, userId),
        eq(games.steamid64Owner, steamid64),
        sql`${games.steamAppId} is not null`,
        notInArray(games.steamAppId, syncedAppIds),
        sql`${games.syncState} <> 'ignored'`,
      ),
    )
    .returning({ id: games.id });
  return missingRows.length;
}

async function insertImportedGamesIntoQueue(tx: Tx, userId: string, importedIds: string[]) {
  const uniqueImportedIds = [...new Set(importedIds.filter(Boolean))];
  if (uniqueImportedIds.length === 0) return 0;

  const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, userId) });
  const importedIdSet = new Set(uniqueImportedIds);
  const existingQueueRows = await tx.query.games.findMany({
    where: and(eq(games.userId, userId), sql`${games.queueRank} is not null`),
    orderBy: [asc(games.queueRank)],
  });
  const importedRows = await tx.query.games.findMany({
    where: and(eq(games.userId, userId), inArray(games.id, uniqueImportedIds)),
    orderBy: [asc(games.title)],
  });

  const existingQueue = existingQueueRows
    .filter((game) => !importedIdSet.has(game.id))
    .map(mapQueueCandidate);
  const newCandidates = filterQueueEligibleCandidates(importedRows.map(mapQueueCandidate));
  if (newCandidates.length === 0) return 0;

  const { queue } = insertGamesWithCategoryBalance(existingQueue, newCandidates, {
    windowSize: settingsRow?.queueSlidingWindowSize ?? DEFAULT_QUEUE_WINDOW_SIZE,
  });
  const queuedCandidateIds = new Set(newCandidates.map((candidate) => candidate.id));
  await persistQueueRanks(tx, userId, queue);
  return queue.filter((item) => queuedCandidateIds.has(item.id) && item.queueRank != null).length;
}

async function rebalanceQueueRanks(tx: Tx, userId: string) {
  const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, userId) });
  const queueRows = await tx.query.games.findMany({
    where: and(eq(games.userId, userId), sql`${games.queueRank} is not null`),
    orderBy: [asc(games.queueRank)],
  });
  const { queue } = rebalanceQueueLogic(queueRows.map(mapQueueCandidate), {
    windowSize: settingsRow?.queueSlidingWindowSize ?? DEFAULT_QUEUE_WINDOW_SIZE,
  });
  await persistQueueRanks(tx, userId, queue);
}

async function persistQueueRanks(tx: Tx, userId: string, queue: QueueCandidate[]) {
  const movable = queue.filter((item) => !item.queueLocked && item.queueRank != null);
  const now = new Date();
  for (let index = 0; index < movable.length; index += 1) {
    await tx
      .update(games)
      .set({ queueRank: -(index + 1) * 1000000, updatedAt: now })
      .where(and(eq(games.userId, userId), eq(games.id, movable[index].id)));
  }
  for (const item of movable) {
    await tx
      .update(games)
      .set({ queueRank: item.queueRank, updatedAt: now })
      .where(and(eq(games.userId, userId), eq(games.id, item.id)));
  }
}

export function statusForImportDecision(
  decision: ImportDecision,
  game: Pick<ParsedCsvGame | SteamLibraryGame, "completionType" | "backlogSlot">,
): GameStatus {
  if (decision === "park") return "parked";
  if (decision === "wont_complete") return "wont_complete";
  if (decision === "queue") return "not_started";
  if (OPEN_ENDED_COMPLETION_TYPES.includes(game.completionType) || game.backlogSlot === "parking_lot") {
    return "parked";
  }
  return "not_started";
}

export function buildReclassificationPatch(game: GameRow, metadata?: SteamStoreMetadata) {
  const genres = metadata?.genres ?? game.genres;
  const tags = metadata?.tags ?? game.tags;
  const releaseYear = metadata?.releaseYear ?? game.releaseYear;
  const steamReviewScore = metadata?.steamReviewScore ?? game.steamReviewScore;
  const completionType = inferCompletionType({ title: game.title, tags, genres });
  const backlogSlot = inferBacklogSlot({
    title: game.title,
    tags,
    genres,
    completionType,
    playtimeMinutes: game.playtimeMinutes,
  });
  const classification = resolveSyncedClassification(game, { backlogSlot, completionType });

  return {
    genres,
    tags,
    releaseYear,
    steamReviewScore,
    ...classification,
    priorityScore: calculatePriorityScore({
      personalInterest: game.personalInterest,
      playtimeMinutes: game.playtimeMinutes,
      steamReviewScore,
      estimatedHours: game.estimatedHours,
      completionType: classification.completionType,
      backlogSlot: classification.backlogSlot,
    }),
    rawImportMetadata: mergeStoreMetadata(game.rawImportMetadata, metadata),
  };
}

function mergeStoreMetadata(rawImportMetadata: Record<string, unknown> | null, metadata?: SteamStoreMetadata) {
  if (!metadata) return rawImportMetadata;
  return {
    ...(rawImportMetadata ?? {}),
    store: metadata.raw,
  };
}

export function resolveSyncedClassification(
  existing: {
    backlogSlot: BacklogSlot;
    completionType: CompletionType;
    manualBacklogSlot: boolean;
    manualCompletionType: boolean;
  },
  incoming: Pick<ParsedCsvGame | SteamLibraryGame, "backlogSlot" | "completionType">,
) {
  return {
    completionType: existing.manualCompletionType ? existing.completionType : incoming.completionType,
    backlogSlot: existing.manualBacklogSlot ? existing.backlogSlot : incoming.backlogSlot,
  };
}

function mapSettings(row: typeof appSettings.$inferSelect): AppSettings {
  return {
    id: row.id,
    userId: row.userId,
    maxActiveRotationCount: row.maxActiveRotationCount,
    maxInstalledCount: row.maxInstalledCount,
    checkinIntervalDays: row.checkinIntervalDays,
    checkinIntervalHoursPlayed: row.checkinIntervalHoursPlayed,
    completedSetsInstalledFalse: row.completedSetsInstalledFalse,
    dnfSetsInstalledFalse: row.dnfSetsInstalledFalse,
    parkedSetsInstalledFalse: row.parkedSetsInstalledFalse,
    inProgressSetsInstalledTrue: row.inProgressSetsInstalledTrue,
    inProgressAddsToRotationWhenSpace: row.inProgressAddsToRotationWhenSpace,
    autoQueueNewImports: row.autoQueueNewImports,
    protectManualFieldsFromSync: row.protectManualFieldsFromSync,
    steamAutoSyncEnabled: row.steamAutoSyncEnabled,
    steamSyncIntervalDays: row.steamSyncIntervalDays,
    steamSyncIntervalHours: row.steamSyncIntervalHours,
    queueSlidingWindowSize: row.queueSlidingWindowSize,
    rotationSkipCooldownDays: row.rotationSkipCooldownDays,
    rotationSkipLimit: row.rotationSkipLimit,
    parkedReassessmentDays: row.parkedReassessmentDays,
    slotWeights: row.slotWeights,
  };
}

function settingsToDb(settings: Partial<AppSettings>) {
  return {
    maxActiveRotationCount: settings.maxActiveRotationCount,
    maxInstalledCount: settings.maxInstalledCount,
    checkinIntervalDays: settings.checkinIntervalDays,
    checkinIntervalHoursPlayed: settings.checkinIntervalHoursPlayed,
    completedSetsInstalledFalse: settings.completedSetsInstalledFalse,
    dnfSetsInstalledFalse: settings.dnfSetsInstalledFalse,
    parkedSetsInstalledFalse: settings.parkedSetsInstalledFalse,
    inProgressSetsInstalledTrue: settings.inProgressSetsInstalledTrue,
    inProgressAddsToRotationWhenSpace: settings.inProgressAddsToRotationWhenSpace,
    autoQueueNewImports: settings.autoQueueNewImports,
    protectManualFieldsFromSync: settings.protectManualFieldsFromSync,
    steamAutoSyncEnabled: settings.steamAutoSyncEnabled,
    steamSyncIntervalDays: settings.steamSyncIntervalDays,
    steamSyncIntervalHours: settings.steamSyncIntervalHours,
    queueSlidingWindowSize: settings.queueSlidingWindowSize,
    rotationSkipCooldownDays: settings.rotationSkipCooldownDays,
    rotationSkipLimit: settings.rotationSkipLimit,
    parkedReassessmentDays: settings.parkedReassessmentDays,
    slotWeights: settings.slotWeights,
  };
}

function mapGame(row: GameRow): Game {
  return {
    id: row.id,
    userId: row.userId,
    steamAppId: row.steamAppId,
    steamid64Owner: row.steamid64Owner,
    title: row.title,
    normalizedTitle: row.normalizedTitle,
    source: row.source,
    playtimeMinutes: row.playtimeMinutes,
    playtimeWindowsMinutes: row.playtimeWindowsMinutes,
    playtimeMacMinutes: row.playtimeMacMinutes,
    playtimeLinuxMinutes: row.playtimeLinuxMinutes,
    lastPlayed: row.lastPlayed,
    achievementsUnlocked: row.achievementsUnlocked,
    achievementsTotal: row.achievementsTotal,
    achievementPercent: row.achievementPercent,
    steamReviewScore: row.steamReviewScore,
    steamReviewSummary: row.steamReviewSummary,
    releaseYear: row.releaseYear,
    genres: row.genres,
    tags: row.tags,
    estimatedHours: row.estimatedHours,
    completionType: row.completionType,
    backlogSlot: row.backlogSlot,
    priorityScore: row.priorityScore,
    queueRank: row.queueRank,
    queueLocked: row.queueLocked,
    rotationSkipCount: row.rotationSkipCount,
    rotationSkipUntil: row.rotationSkipUntil,
    rotationLastSkippedAt: row.rotationLastSkippedAt,
    parkedForLater: row.parkedForLater,
    reassessAfter: row.reassessAfter,
    status: row.status,
    installed: row.installed,
    currentRotation: row.currentRotation,
    dateAdded: row.dateAdded,
    dateStarted: row.dateStarted,
    dateCompleted: row.dateCompleted,
    dateDnf: row.dateDnf,
    dnfReason: row.dnfReason,
    personalInterest: row.personalInterest,
    syncState: row.syncState,
    firstSeenAt: row.firstSeenAt,
    lastSeenInSyncAt: row.lastSeenInSyncAt,
    lastSyncedAt: row.lastSyncedAt,
    notes: row.notes,
    manualBacklogSlot: row.manualBacklogSlot,
    manualCompletionType: row.manualCompletionType,
    rawImportMetadata: row.rawImportMetadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapGameSummary(row: GameRow): GameSummary {
  const game = mapGame(row);
  return {
    id: game.id,
    title: game.title,
    steamAppId: game.steamAppId,
    status: game.status,
    installed: game.installed,
    currentRotation: game.currentRotation,
    backlogSlot: game.backlogSlot,
    completionType: game.completionType,
    priorityScore: game.priorityScore,
    queueRank: game.queueRank,
    queueLocked: game.queueLocked,
    rotationSkipCount: game.rotationSkipCount,
    rotationSkipUntil: game.rotationSkipUntil,
    rotationLastSkippedAt: game.rotationLastSkippedAt,
    parkedForLater: game.parkedForLater,
    reassessAfter: game.reassessAfter,
    personalInterest: game.personalInterest,
    playtimeMinutes: game.playtimeMinutes,
    achievementPercent: game.achievementPercent,
    estimatedHours: game.estimatedHours,
    steamReviewScore: game.steamReviewScore,
    steamReviewSummary: game.steamReviewSummary,
    releaseYear: game.releaseYear,
    lastPlayed: game.lastPlayed,
    dateAdded: game.dateAdded,
    lastSyncedAt: game.lastSyncedAt,
    syncState: game.syncState,
    steamid64Owner: game.steamid64Owner,
    notes: game.notes,
    dnfReason: game.dnfReason,
  };
}

function mapStatusHistoryEntry(row: typeof statusHistory.$inferSelect): GameStatusHistoryEntry {
  return {
    id: row.id,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    changedAt: row.changedAt,
    notes: row.notes,
  };
}

function mapGameVisibilitySnapshot(row: GameRow): GameVisibilitySnapshot {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    currentRotation: row.currentRotation,
    queueRank: row.queueRank,
    backlogSlot: row.backlogSlot,
    completionType: row.completionType,
    syncState: row.syncState,
    playtimeMinutes: row.playtimeMinutes,
    detailHref: `/games/${row.id}`,
  };
}

function mapQueueCandidate(row: GameRow): QueueCandidate {
  return {
    id: row.id,
    title: row.title,
    backlogSlot: row.backlogSlot,
    completionType: row.completionType,
    priorityScore: row.priorityScore,
    personalInterest: row.personalInterest,
    estimatedHours: row.estimatedHours,
    queueLocked: row.queueLocked,
    queueRank: row.queueRank,
    tags: row.tags,
    playtimeMinutes: row.playtimeMinutes,
    steamReviewScore: row.steamReviewScore,
    releaseYear: row.releaseYear,
    lastPlayed: row.lastPlayed,
    status: row.status,
    currentRotation: row.currentRotation,
    syncState: row.syncState,
    dateAdded: row.dateAdded,
    parkedForLater: row.parkedForLater,
  };
}

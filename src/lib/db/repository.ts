import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";

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
  DEFAULT_QUEUE_WINDOW_SIZE,
  DEFAULT_SLOT_WEIGHTS,
  PARKING_COMPLETION_TYPES,
  type BacklogSlot,
  type CompletionType,
  type GameStatus,
  type PersonalInterest,
} from "@/lib/backlog/constants";
import {
  filterQueueEligibleCandidates,
  insertGamesWithCategoryBalance,
  rebalanceQueue as rebalanceQueueLogic,
} from "@/lib/backlog/queue";
import { parseSteamCsv } from "@/lib/backlog/csv";
import { calculatePriorityScore } from "@/lib/backlog/inference";
import { normalizeTitle } from "@/lib/backlog/normalize";
import { transitionGameStatus } from "@/lib/backlog/status";
import type { AppSettings, Game, GameSummary, ParsedCsvGame, QueueCandidate } from "@/lib/backlog/types";
import { isDatabaseConfigured } from "@/lib/env";
import type { SteamLibraryGame, SteamLibrarySyncData } from "@/lib/steam/library";
import { type AppUser, withUserDb } from "./client";

type GameRow = typeof gamesTable.$inferSelect;
type Tx = Parameters<Parameters<ReturnType<typeof import("./client").getDb>["transaction"]>[0]>[0];

export type ImportDecision = "unqueued" | "queue" | "park" | "wont_complete" | "review";

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
    queueSlidingWindowSize: DEFAULT_QUEUE_WINDOW_SIZE,
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
    if (currentRotation) {
      const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, user.id) });
      const max = settingsRow?.maxActiveRotationCount ?? DEFAULT_ACTIVE_ROTATION_COUNT;
      const activeCount = await getActiveCount(tx, user.id);
      const target = await tx.query.games.findFirst({ where: and(eq(games.userId, user.id), eq(games.id, gameId)) });
      if (!target) throw new Error("Game not found.");
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
      .set({ currentRotation, installed: currentRotation ? true : undefined, updatedAt: new Date() })
      .where(and(eq(games.userId, user.id), eq(games.id, gameId)));
  });
}

export async function updateGameFields(
  user: AppUser,
  gameId: string,
  fields: Partial<{
    backlogSlot: BacklogSlot;
    completionType: CompletionType;
    personalInterest: PersonalInterest;
    queueRank: number | null;
    queueLocked: boolean;
    notes: string | null;
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
      return;
    }

    if (input.action === "set_slot" && input.backlogSlot) {
      await tx
        .update(games)
        .set({ backlogSlot: input.backlogSlot, manualBacklogSlot: true, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      return;
    }

    if (input.action === "set_completion_type" && input.completionType) {
      await tx
        .update(games)
        .set({ completionType: input.completionType, manualCompletionType: true, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      return;
    }

    if (input.action === "set_interest" && input.personalInterest) {
      await tx
        .update(games)
        .set({ personalInterest: input.personalInterest, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      return;
    }

    if (input.action === "park") {
      await tx
        .update(games)
        .set({ status: "parked", currentRotation: false, installed: false, queueRank: null, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
      return;
    }

    if (input.action === "wont_complete") {
      await tx
        .update(games)
        .set({ status: "wont_complete", currentRotation: false, installed: false, queueRank: null, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
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
        .set({ syncState: "ignored", currentRotation: false, queueRank: null, updatedAt: new Date() })
        .where(and(eq(games.userId, input.user.id), inArray(games.id, gameIds)));
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

export async function updateSettings(user: AppUser, next: Partial<AppSettings>) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const currentActiveCount = await getActiveCount(tx, user.id);
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
            completionType: existing.manualCompletionType ? existing.completionType : row.normalized.completionType,
            backlogSlot: existing.manualBacklogSlot ? existing.backlogSlot : row.normalized.backlogSlot,
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
        notes: `Decision: ${input.decision}; source: Steam Web API library sync`,
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
    };
  });
}

export async function rebalanceUserQueue(user: AppUser) {
  if (!isDatabaseConfigured()) throw new Error("DATABASE_URL is not configured.");
  return withUserDb(user, async (tx) => {
    const settingsRow = await tx.query.appSettings.findFirst({ where: eq(appSettings.userId, user.id) });
    const queueRows = await tx.query.games.findMany({
      where: and(eq(games.userId, user.id), sql`${games.queueRank} is not null`),
      orderBy: [asc(games.queueRank)],
    });
    const { queue } = rebalanceQueueLogic(queueRows.map(mapQueueCandidate), {
      windowSize: settingsRow?.queueSlidingWindowSize ?? DEFAULT_QUEUE_WINDOW_SIZE,
    });
    await persistQueueRanks(tx, user.id, queue);
  });
}

async function getActiveCount(tx: Tx, userId: string) {
  const result = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(games)
    .where(and(eq(games.userId, userId), eq(games.currentRotation, true)));
  return result[0]?.count ?? 0;
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

function statusForImportDecision(
  decision: ImportDecision,
  game: Pick<ParsedCsvGame | SteamLibraryGame, "completionType" | "backlogSlot">,
): GameStatus {
  if (decision === "park") return "parked";
  if (decision === "wont_complete") return "wont_complete";
  if (PARKING_COMPLETION_TYPES.includes(game.completionType) || game.backlogSlot === "parking_lot") {
    return "parked";
  }
  return "not_started";
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
    queueSlidingWindowSize: row.queueSlidingWindowSize,
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
    queueSlidingWindowSize: settings.queueSlidingWindowSize,
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
    status: row.status,
    currentRotation: row.currentRotation,
    syncState: row.syncState,
    dateAdded: row.dateAdded,
  };
}

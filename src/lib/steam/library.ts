import { calculatePriorityScore, inferBacklogSlot, inferCompletionType } from "@/lib/backlog/inference";
import type { BacklogSlot, CompletionType } from "@/lib/backlog/constants";
import { EMPTY_DECK_PLAYABILITY, type DeckPlayabilityData } from "./deck-playability";
import type { SteamStoreMetadata } from "./metadata";

export type SteamAccountProfile = {
  steamid64: string;
  displayName: string | null;
  customProfileId: string | null;
  profileUrl: string | null;
};

export type RawSteamOwnedGame = Record<string, unknown>;

export type SteamLibraryGame = {
  title: string;
  steamAppId: number;
  steamid64Owner: string;
  playtimeMinutes: number;
  playtimeWindowsMinutes: number | null;
  playtimeMacMinutes: number | null;
  playtimeLinuxMinutes: number | null;
  lastPlayed: Date | null;
  steamReviewScore: number | null;
  releaseYear: number | null;
  genres: string[] | null;
  tags: string[] | null;
  steamDeckCompatibilityCategory: DeckPlayabilityData["steamDeckCompatibilityCategory"];
  steamDeckCompatibilityItems: DeckPlayabilityData["steamDeckCompatibilityItems"];
  protondbTier: string | null;
  protondbConfidence: string | null;
  protondbScore: number | null;
  protondbReportCount: number | null;
  deckPlayabilityUpdatedAt: Date | null;
  deckPlayabilityRaw: Record<string, unknown> | null;
  completionType: CompletionType;
  backlogSlot: BacklogSlot;
  priorityScore: number;
  rawImportMetadata: Record<string, unknown>;
};

export type SteamLibraryPreviewRow = {
  rowNumber: number;
  valid: boolean;
  reason?: string;
  raw: Record<string, unknown>;
  normalized?: SteamLibraryGame;
};

export type SteamLibrarySyncData = {
  identifier: string;
  account: SteamAccountProfile;
  games: SteamLibraryGame[];
  rowCount: number;
  validCount: number;
  skippedCount: number;
  metadataEnrichedCount: number;
  metadataFailedCount: number;
  deckPlayabilityEnrichedCount: number;
  deckPlayabilityFailedCount: number;
  privateOrEmpty: boolean;
};

export type SteamLibraryPreview = SteamLibrarySyncData & {
  rows: SteamLibraryPreviewRow[];
};

export function buildSteamLibraryPreview(input: {
  identifier: string;
  account: SteamAccountProfile;
  games: RawSteamOwnedGame[];
  storeMetadataByAppId?: Map<number, SteamStoreMetadata>;
  metadataFailedAppIds?: Set<number>;
  deckPlayabilityByAppId?: Map<number, DeckPlayabilityData>;
  deckPlayabilityFailedAppIds?: Set<number>;
  sampleLimit?: number;
}): SteamLibraryPreview {
  const rows: SteamLibraryPreviewRow[] = [];
  const normalizedGames: SteamLibraryGame[] = [];
  let skippedCount = 0;
  let metadataEnrichedCount = 0;
  let metadataFailedCount = 0;
  let deckPlayabilityEnrichedCount = 0;
  let deckPlayabilityFailedCount = 0;

  input.games.forEach((raw, index) => {
    const steamAppId = parsePositiveInteger(raw.appid);
    const metadata = steamAppId == null ? undefined : input.storeMetadataByAppId?.get(steamAppId);
    const metadataFailed = steamAppId == null ? false : input.metadataFailedAppIds?.has(steamAppId) === true;
    const deckPlayability = steamAppId == null ? undefined : input.deckPlayabilityByAppId?.get(steamAppId);
    const deckPlayabilityFailed =
      steamAppId == null ? false : input.deckPlayabilityFailedAppIds?.has(steamAppId) === true;
    const result = normalizeSteamOwnedGame(raw, input.account.steamid64, metadata, deckPlayability);
    if (result.valid) {
      normalizedGames.push(result.normalized);
      if (metadata) metadataEnrichedCount += 1;
      if (!metadata && metadataFailed) metadataFailedCount += 1;
      if (deckPlayability) deckPlayabilityEnrichedCount += 1;
      if (!deckPlayability && deckPlayabilityFailed) deckPlayabilityFailedCount += 1;
      if (rows.length < (input.sampleLimit ?? 100)) {
        rows.push({ rowNumber: index + 1, valid: true, raw, normalized: result.normalized });
      }
    } else {
      skippedCount += 1;
      if (rows.length < (input.sampleLimit ?? 100)) {
        rows.push({ rowNumber: index + 1, valid: false, raw, reason: result.reason });
      }
    }
  });

  return {
    identifier: input.identifier,
    account: input.account,
    games: normalizedGames,
    rowCount: input.games.length,
    validCount: normalizedGames.length,
    skippedCount,
    metadataEnrichedCount,
    metadataFailedCount,
    deckPlayabilityEnrichedCount,
    deckPlayabilityFailedCount,
    privateOrEmpty: input.games.length === 0,
    rows,
  };
}

export function normalizeSteamOwnedGame(
  raw: RawSteamOwnedGame,
  steamid64Owner: string,
  metadata?: SteamStoreMetadata,
  deckPlayability?: DeckPlayabilityData,
): { valid: true; normalized: SteamLibraryGame } | { valid: false; reason: string } {
  const steamAppId = parsePositiveInteger(raw.appid);
  if (steamAppId == null) return { valid: false, reason: "Missing app id" };

  const title = String(raw.name ?? "").trim();
  if (!title) return { valid: false, reason: "Missing title" };

  const playtimeMinutes = parseNonNegativeInteger(raw.playtime_forever) ?? 0;
  const playtimeWindowsMinutes = parseNonNegativeInteger(raw.playtime_windows_forever);
  const playtimeMacMinutes = parseNonNegativeInteger(raw.playtime_mac_forever);
  const playtimeLinuxMinutes = parseNonNegativeInteger(raw.playtime_linux_forever);
  const lastPlayed = parseUnixSeconds(raw.rtime_last_played);
  const genres = metadata?.genres ?? null;
  const tags = metadata?.tags ?? null;
  const steamReviewScore = metadata?.steamReviewScore ?? null;
  const releaseYear = metadata?.releaseYear ?? null;
  const deck = deckPlayability ?? EMPTY_DECK_PLAYABILITY;
  const completionType = inferCompletionType({ title, tags, genres });
  const backlogSlot = inferBacklogSlot({ title, tags, genres, completionType, playtimeMinutes });
  const priorityScore = calculatePriorityScore({
    playtimeMinutes,
    steamReviewScore,
    completionType,
    backlogSlot,
  });

  return {
    valid: true,
    normalized: {
      title,
      steamAppId,
      steamid64Owner,
      playtimeMinutes,
      playtimeWindowsMinutes,
      playtimeMacMinutes,
      playtimeLinuxMinutes,
      lastPlayed,
      steamReviewScore,
      releaseYear,
      genres,
      tags,
      steamDeckCompatibilityCategory: deck.steamDeckCompatibilityCategory,
      steamDeckCompatibilityItems: deck.steamDeckCompatibilityItems,
      protondbTier: deck.protondbTier,
      protondbConfidence: deck.protondbConfidence,
      protondbScore: deck.protondbScore,
      protondbReportCount: deck.protondbReportCount,
      deckPlayabilityUpdatedAt: deck.deckPlayabilityUpdatedAt,
      deckPlayabilityRaw: deck.deckPlayabilityRaw,
      completionType,
      backlogSlot,
      priorityScore,
      rawImportMetadata: {
        source: "steam_library",
        owner: steamid64Owner,
        steam: raw,
        ...(metadata ? { store: metadata.raw } : {}),
        ...(deck.deckPlayabilityRaw ? { deck_playability: deck.deckPlayabilityRaw } : {}),
      },
    },
  };
}

function parsePositiveInteger(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function parseNonNegativeInteger(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

function parseUnixSeconds(value: unknown) {
  const seconds = parseNonNegativeInteger(value);
  if (!seconds) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

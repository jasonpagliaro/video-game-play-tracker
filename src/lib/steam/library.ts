import { calculatePriorityScore, inferBacklogSlot, inferCompletionType } from "@/lib/backlog/inference";
import type { BacklogSlot, CompletionType } from "@/lib/backlog/constants";

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
  privateOrEmpty: boolean;
};

export type SteamLibraryPreview = SteamLibrarySyncData & {
  rows: SteamLibraryPreviewRow[];
};

export function buildSteamLibraryPreview(input: {
  identifier: string;
  account: SteamAccountProfile;
  games: RawSteamOwnedGame[];
  sampleLimit?: number;
}): SteamLibraryPreview {
  const rows: SteamLibraryPreviewRow[] = [];
  const normalizedGames: SteamLibraryGame[] = [];
  let skippedCount = 0;

  input.games.forEach((raw, index) => {
    const result = normalizeSteamOwnedGame(raw, input.account.steamid64);
    if (result.valid) {
      normalizedGames.push(result.normalized);
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
    privateOrEmpty: input.games.length === 0,
    rows,
  };
}

export function normalizeSteamOwnedGame(
  raw: RawSteamOwnedGame,
  steamid64Owner: string,
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
  const completionType = inferCompletionType({ title });
  const backlogSlot = inferBacklogSlot({ title, completionType, playtimeMinutes });
  const priorityScore = calculatePriorityScore({
    playtimeMinutes,
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
      completionType,
      backlogSlot,
      priorityScore,
      rawImportMetadata: {
        source: "steam_library",
        owner: steamid64Owner,
        steam: raw,
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

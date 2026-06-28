import Papa from "papaparse";
import { z } from "zod";

import { inferBacklogSlot, inferCompletionType, calculatePriorityScore } from "./inference";
import {
  normalizeTitle,
  parseOptionalDate,
  parseOptionalNumber,
  splitList,
  toMinutesFromHours,
} from "./normalize";
import type { CsvMapping, CsvPreview, CsvPreviewRow, ParsedCsvGame } from "./types";
import { normalizeSteamDeckCompatibilityCategory } from "@/lib/steam/deck-playability";

const columnAliases: Record<string, string[]> = {
  title: ["title", "game", "name"],
  steamAppId: ["app id", "appid", "app_id", "steam app id", "steam_app_id", "id"],
  playtimeMinutes: ["playtime minutes", "playtime_minutes", "minutes played"],
  playtimeHours: ["playtime", "playtime forever", "hours played", "hours"],
  lastPlayed: ["last played", "last_played"],
  steamReviewScore: ["review score", "metascore", "userscore", "wilsonscore", "sdbrating"],
  steamReviewSummary: ["review summary"],
  steamDeckCompatibilityCategory: ["steam deck", "steam_deck", "deck compatibility", "steam deck compatibility"],
  tags: ["tags", "tag"],
  genres: ["genres", "genre"],
  achievements: ["achievements"],
  achievementPercent: ["achievement percent", "achievement_percent"],
  releaseDate: ["release date", "release_date"],
};

const rowSchema = z.record(z.string(), z.string().or(z.number()).or(z.null()).or(z.undefined()));

function normalizeHeader(header: string) {
  return header
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function mapCsvColumns(headers: string[]): CsvMapping {
  const normalized = headers.map((header) => ({ raw: header, normalized: normalizeHeader(header) }));
  const mapping: CsvMapping = {};
  for (const [field, aliases] of Object.entries(columnAliases)) {
    const match = normalized.find((header) => aliases.includes(header.normalized));
    mapping[field] = match?.raw ?? null;
  }
  return mapping;
}

export function getUnknownColumns(headers: string[], mapping: CsvMapping) {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  return headers.filter((header) => !mapped.has(header));
}

function getValue(row: Record<string, unknown>, mapping: CsvMapping, key: string) {
  const column = mapping[key];
  return column ? row[column] : undefined;
}

function parseAchievements(value: unknown) {
  if (value == null || String(value).trim() === "") {
    return { achievementsUnlocked: null, achievementsTotal: null, achievementPercent: null };
  }
  const text = String(value);
  const fraction = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (fraction) {
    const unlocked = Number(fraction[1]);
    const total = Number(fraction[2]);
    return {
      achievementsUnlocked: unlocked,
      achievementsTotal: total,
      achievementPercent: total > 0 ? Math.round((unlocked / total) * 100) : null,
    };
  }
  const percent = parseOptionalNumber(text);
  return { achievementsUnlocked: null, achievementsTotal: null, achievementPercent: percent };
}

export function parseCsvRow(
  row: Record<string, unknown>,
  mapping: CsvMapping,
): { valid: true; normalized: ParsedCsvGame } | { valid: false; reason: string } {
  const title = String(getValue(row, mapping, "title") ?? "").trim();
  if (!title) return { valid: false, reason: "Missing title" };

  const steamAppId = parseOptionalNumber(getValue(row, mapping, "steamAppId"));
  const minutesColumn = parseOptionalNumber(getValue(row, mapping, "playtimeMinutes"));
  const playtimeMinutes =
    minutesColumn != null ? Math.max(0, Math.round(minutesColumn)) : toMinutesFromHours(getValue(row, mapping, "playtimeHours"));
  const lastPlayed = parseOptionalDate(getValue(row, mapping, "lastPlayed"));
  const releaseDate = parseOptionalDate(getValue(row, mapping, "releaseDate"));
  const releaseYear = releaseDate?.getFullYear() ?? null;
  const tags = splitList(getValue(row, mapping, "tags"));
  const genres = splitList(getValue(row, mapping, "genres"));
  const reviewScore = parseOptionalNumber(getValue(row, mapping, "steamReviewScore"));
  const steamReviewSummary = String(getValue(row, mapping, "steamReviewSummary") ?? "").trim() || null;
  const rawDeckCompatibility = getValue(row, mapping, "steamDeckCompatibilityCategory");
  const steamDeckCompatibilityCategory = normalizeSteamDeckCompatibilityCategory(rawDeckCompatibility);
  const achievements = parseAchievements(getValue(row, mapping, "achievements"));
  const achievementPercent =
    parseOptionalNumber(getValue(row, mapping, "achievementPercent")) ?? achievements.achievementPercent;
  const completionType = inferCompletionType({ title, tags, genres });
  const backlogSlot = inferBacklogSlot({ title, tags, genres, completionType, playtimeMinutes });
  const priorityScore = calculatePriorityScore({
    playtimeMinutes,
    steamReviewScore: reviewScore,
    completionType,
    backlogSlot,
  });

  return {
    valid: true,
    normalized: {
      title,
      steamAppId: steamAppId == null ? null : Math.trunc(steamAppId),
      playtimeMinutes,
      lastPlayed,
      steamReviewScore: reviewScore,
      steamReviewSummary,
      releaseYear,
      genres,
      tags,
      steamDeckCompatibilityCategory,
      steamDeckCompatibilityItems: null,
      protondbTier: null,
      protondbConfidence: null,
      protondbScore: null,
      protondbReportCount: null,
      deckPlayabilityUpdatedAt: steamDeckCompatibilityCategory ? new Date() : null,
      deckPlayabilityRaw:
        rawDeckCompatibility == null || String(rawDeckCompatibility).trim() === ""
          ? null
          : { csv: { steam_deck: String(rawDeckCompatibility).trim() } },
      achievementsUnlocked: achievements.achievementsUnlocked,
      achievementsTotal: achievements.achievementsTotal,
      achievementPercent,
      completionType,
      backlogSlot,
      priorityScore,
      rawImportMetadata: row,
    },
  };
}

export function parseSteamCsv(csvText: string, filename = "library.csv", sampleLimit = 100): CsvPreview {
  const parsed = Papa.parse<Record<string, unknown>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const mapping = mapCsvColumns(headers);
  const unknownColumns = getUnknownColumns(headers, mapping);
  const rows: CsvPreviewRow[] = [];
  let validCount = 0;
  let skippedCount = 0;

  parsed.data.forEach((rawRow, index) => {
    const rowResult = rowSchema.safeParse(rawRow);
    const raw = Object.fromEntries(
      Object.entries(rowResult.success ? rowResult.data : rawRow).map(([key, value]) => [
        key,
        value == null ? "" : String(value),
      ]),
    );
    const result = parseCsvRow(raw, mapping);
    if (result.valid) {
      validCount += 1;
      if (rows.length < sampleLimit) {
        rows.push({ rowNumber: index + 2, valid: true, raw, normalized: result.normalized });
      }
    } else {
      skippedCount += 1;
      if (rows.length < sampleLimit) {
        rows.push({ rowNumber: index + 2, valid: false, raw, reason: result.reason });
      }
    }
  });

  return {
    filename,
    rowCount: parsed.data.length,
    validCount,
    skippedCount,
    headers,
    mapping,
    unknownColumns,
    rows,
  };
}

export function normalizeImportTitle(title: string) {
  return normalizeTitle(title);
}

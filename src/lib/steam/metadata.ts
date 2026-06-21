export type SteamStoreMetadata = {
  genres: string[] | null;
  tags: string[] | null;
  releaseYear: number | null;
  steamReviewScore: number | null;
  raw: Record<string, unknown>;
};

export type SteamStoreMetadataFetchResult = {
  metadataByAppId: Map<number, SteamStoreMetadata>;
  failedAppIds: Set<number>;
};

export const STORE_APPDETAILS_FILTERS = "genres,categories,release_date,metacritic";

export function normalizeSteamStoreAppMetadata(raw: unknown): SteamStoreMetadata | null {
  if (!isRecord(raw)) return null;
  const genres = parseDescriptions(raw.genres);
  const tags = parseDescriptions(raw.categories);
  const releaseYear = parseReleaseYear(raw.release_date);
  const steamReviewScore = parseMetacriticScore(raw.metacritic);

  if (!genres && !tags && releaseYear == null && steamReviewScore == null) return null;

  return {
    genres,
    tags,
    releaseYear,
    steamReviewScore,
    raw,
  };
}

function parseDescriptions(value: unknown) {
  if (!Array.isArray(value)) return null;
  const descriptions = value
    .map((item) => (isRecord(item) ? String(item.description ?? "").trim() : ""))
    .filter(Boolean);
  return descriptions.length ? [...new Set(descriptions)] : null;
}

function parseReleaseYear(value: unknown) {
  if (!isRecord(value) || value.coming_soon === true) return null;
  const dateText = String(value.date ?? "");
  const match = dateText.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function parseMetacriticScore(value: unknown) {
  if (!isRecord(value)) return null;
  const parsed = Number(value.score);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
  return Math.round(parsed);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

import {
  EMPTY_DECK_PLAYABILITY,
  normalizeProtonDbTier,
  normalizeSteamDeckCompatibilityCategory,
  normalizeSteamDeckCompatibilityItem,
  type DeckPlayabilityData,
  type SteamDeckCompatibilityCategory,
  type SteamDeckCompatibilityItem,
} from "@/lib/steam/deck-playability";
import { isRecord } from "@/lib/steam/metadata";

const STEAM_STORE_BASE = "https://store.steampowered.com";
const PROTONDB_BASE = "https://www.protondb.com";
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_REQUEST_TIMEOUT_MS = 7000;

export type DeckPlayabilityFetchResult = {
  playabilityByAppId: Map<number, DeckPlayabilityData>;
  failedAppIds: Set<number>;
};

type SteamDeckCompatibilityPayload = {
  category: SteamDeckCompatibilityCategory | null;
  items: SteamDeckCompatibilityItem[] | null;
  raw: Record<string, unknown>;
};

type ProtonDbPayload = {
  tier: string | null;
  confidence: string | null;
  score: number | null;
  reportCount: number | null;
  raw: Record<string, unknown>;
};

export async function fetchDeckPlayabilityForAppIds(
  appIds: number[],
  options: { concurrency?: number; requestTimeoutMs?: number } = {},
): Promise<DeckPlayabilityFetchResult> {
  const validAppIds = [
    ...new Set(appIds.filter((appId) => Number.isInteger(appId) && appId > 0).map((appId) => Math.trunc(appId))),
  ];
  const playabilityByAppId = new Map<number, DeckPlayabilityData>();
  const failedAppIds = new Set<number>();
  const concurrency = Math.max(1, Math.trunc(options.concurrency ?? DEFAULT_CONCURRENCY));
  const requestTimeoutMs = Math.max(1000, Math.trunc(options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS));

  await runWithConcurrency(validAppIds, concurrency, async (appId) => {
    const result = await fetchDeckPlayabilityForAppId(appId, requestTimeoutMs);
    if (result.playability) {
      playabilityByAppId.set(appId, result.playability);
    } else if (result.failed) {
      failedAppIds.add(appId);
    }
  });

  return { playabilityByAppId, failedAppIds };
}

export function extractSteamDeckCompatibilityFromHtml(html: string): SteamDeckCompatibilityPayload | null {
  const match = html.match(/\sdata-deckcompatibility="([^"]+)"/);
  if (!match) return null;

  const decoded = decodeHtmlAttribute(match[1]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const category = normalizeSteamDeckCompatibilityCategory(parsed.resolved_category);
  const items = Array.isArray(parsed.resolved_items)
    ? parsed.resolved_items.filter(isRecord).map(normalizeSteamDeckCompatibilityItem)
    : null;

  return {
    category,
    items: items?.length ? items : null,
    raw: parsed,
  };
}

export function normalizeProtonDbSummary(raw: unknown): ProtonDbPayload | null {
  if (!isRecord(raw)) return null;
  const tier = normalizeProtonDbTier(raw.tier ?? raw.bestReportedTier ?? raw.trendingTier);
  const score = normalizeFiniteNumber(raw.score);
  const total = normalizeNonnegativeInteger(raw.total);
  const confidence = typeof raw.confidence === "string" && raw.confidence.trim() ? raw.confidence.trim() : null;
  if (!tier && score == null && total == null && !confidence) return null;

  return {
    tier,
    confidence,
    score,
    reportCount: total,
    raw,
  };
}

async function fetchDeckPlayabilityForAppId(appId: number, requestTimeoutMs: number) {
  let failed = false;
  const [steamResult, protonDbResult] = await Promise.all([
    fetchSteamDeckCompatibility(appId, requestTimeoutMs).catch(() => {
      failed = true;
      return null;
    }),
    fetchProtonDbSummary(appId, requestTimeoutMs).catch(() => {
      failed = true;
      return null;
    }),
  ]);

  const raw: Record<string, unknown> = {};
  if (steamResult) raw.steam = steamResult.raw;
  if (protonDbResult) raw.protondb = protonDbResult.raw;

  const playability: DeckPlayabilityData = {
    ...EMPTY_DECK_PLAYABILITY,
    steamDeckCompatibilityCategory: steamResult?.category ?? null,
    steamDeckCompatibilityItems: steamResult?.items ?? null,
    protondbTier: protonDbResult?.tier ?? null,
    protondbConfidence: protonDbResult?.confidence ?? null,
    protondbScore: protonDbResult?.score ?? null,
    protondbReportCount: protonDbResult?.reportCount ?? null,
    deckPlayabilityUpdatedAt: new Date(),
    deckPlayabilityRaw: Object.keys(raw).length ? raw : null,
  };

  const hasData =
    playability.steamDeckCompatibilityCategory ||
    playability.steamDeckCompatibilityItems ||
    playability.protondbTier ||
    playability.protondbConfidence ||
    playability.protondbScore != null ||
    playability.protondbReportCount != null;

  return {
    failed,
    playability: hasData ? playability : null,
  };
}

async function fetchSteamDeckCompatibility(appId: number, requestTimeoutMs: number) {
  const url = new URL(`/app/${appId}/`, STEAM_STORE_BASE);
  url.searchParams.set("cc", "US");
  url.searchParams.set("l", "english");
  const response = await fetchWithTimeout(url, requestTimeoutMs);
  if (!response.ok) throw new Error(`Steam Deck compatibility request failed with HTTP ${response.status}.`);
  return extractSteamDeckCompatibilityFromHtml(await response.text());
}

async function fetchProtonDbSummary(appId: number, requestTimeoutMs: number) {
  const response = await fetchWithTimeout(new URL(`/api/v1/reports/summaries/${appId}.json`, PROTONDB_BASE), requestTimeoutMs);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`ProtonDB summary request failed with HTTP ${response.status}.`);
  return normalizeProtonDbSummary(await response.json());
}

async function fetchWithTimeout(url: URL, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "video-game-play-tracker/0.1 deck-playability",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function normalizeFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNonnegativeInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

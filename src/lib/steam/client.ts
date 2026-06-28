import { getSteamApiKey } from "@/lib/env";
import { parseSteamIdentifier } from "./identifier";
import {
  buildSteamLibraryPreview,
  type RawSteamOwnedGame,
  type SteamAccountProfile,
  type SteamLibraryPreview,
} from "./library";
import { fetchDeckPlayabilityForAppIds } from "./deck-playability-fetch";
import {
  isRecord,
  normalizeSteamStoreAppMetadata,
  STORE_APPDETAILS_FILTERS,
  type SteamStoreMetadata,
  type SteamStoreMetadataFetchResult,
} from "./metadata";

const STEAM_API_BASE = "https://api.steampowered.com";
const STEAM_STORE_API_BASE = "https://store.steampowered.com";
const STORE_APPDETAILS_CHUNK_SIZE = 50;

type ResolveVanityResponse = {
  response?: {
    success?: number;
    steamid?: string;
    message?: string;
  };
};

type PlayerSummariesResponse = {
  response?: {
    players?: Array<{
      steamid?: string;
      personaname?: string;
      profileurl?: string;
    }>;
  };
};

type OwnedGamesResponse = {
  response?: {
    game_count?: number;
    games?: RawSteamOwnedGame[];
  };
};

export async function fetchSteamLibraryPreview(
  identifier: string,
  options: { sampleLimit?: number; enrichMetadata?: boolean } = {},
): Promise<SteamLibraryPreview> {
  const parsed = parseSteamIdentifier(identifier);
  const steamid64 = parsed.kind === "steamid64" ? parsed.steamid64 : await resolveVanityUrl(parsed.vanity);
  const account = await fetchPlayerSummary(steamid64);
  const games = await fetchOwnedGames(steamid64);
  const appIds = games.map((game) => Number(game.appid));
  const [metadata, deckPlayability] =
    options.enrichMetadata === false
      ? [
          { metadataByAppId: new Map(), failedAppIds: new Set<number>() },
          { playabilityByAppId: new Map(), failedAppIds: new Set<number>() },
        ]
      : await Promise.all([fetchSteamStoreMetadataForAppIds(appIds), fetchDeckPlayabilityForAppIds(appIds)]);

  return buildSteamLibraryPreview({
    identifier,
    account,
    games,
    storeMetadataByAppId: metadata.metadataByAppId,
    metadataFailedAppIds: metadata.failedAppIds,
    deckPlayabilityByAppId: deckPlayability.playabilityByAppId,
    deckPlayabilityFailedAppIds: deckPlayability.failedAppIds,
    sampleLimit: options.sampleLimit,
  });
}

export async function fetchSteamStoreMetadataForAppIds(appIds: number[]): Promise<SteamStoreMetadataFetchResult> {
  const validAppIds = [
    ...new Set(appIds.filter((appId) => Number.isInteger(appId) && appId > 0).map((appId) => Math.trunc(appId))),
  ];
  const metadataByAppId = new Map<number, SteamStoreMetadata>();
  const failedAppIds = new Set<number>();

  for (let index = 0; index < validAppIds.length; index += STORE_APPDETAILS_CHUNK_SIZE) {
    const chunk = validAppIds.slice(index, index + STORE_APPDETAILS_CHUNK_SIZE);
    try {
      const json = await fetchStoreAppDetails(chunk);
      for (const appId of chunk) {
        const entry = json[String(appId)];
        const data = isRecord(entry) && entry.success === true ? entry.data : null;
        const metadata = normalizeSteamStoreAppMetadata(data);
        if (metadata) {
          metadataByAppId.set(appId, metadata);
        } else {
          failedAppIds.add(appId);
        }
      }
    } catch {
      for (const appId of chunk) {
        failedAppIds.add(appId);
      }
    }
  }

  return { metadataByAppId, failedAppIds };
}

async function resolveVanityUrl(vanity: string) {
  const json = await steamGetJson<ResolveVanityResponse>("/ISteamUser/ResolveVanityURL/v1/", {
    vanityurl: vanity,
    url_type: "1",
  });
  const response = json.response;
  if (response?.success === 1 && response.steamid) return response.steamid;
  throw new Error(response?.message || "Steam vanity profile was not found.");
}

async function fetchPlayerSummary(steamid64: string): Promise<SteamAccountProfile> {
  const json = await steamGetJson<PlayerSummariesResponse>("/ISteamUser/GetPlayerSummaries/v2/", {
    steamids: steamid64,
  });
  const player = json.response?.players?.[0];
  return {
    steamid64,
    displayName: player?.personaname ?? null,
    customProfileId: extractCustomProfileId(player?.profileurl ?? null),
    profileUrl: player?.profileurl ?? `https://steamcommunity.com/profiles/${steamid64}/`,
  };
}

async function fetchOwnedGames(steamid64: string) {
  const json = await steamGetJson<OwnedGamesResponse>("/IPlayerService/GetOwnedGames/v1/", {
    steamid: steamid64,
    include_appinfo: "true",
    include_played_free_games: "true",
  });
  return json.response?.games ?? [];
}

async function fetchStoreAppDetails(appIds: number[]) {
  const url = new URL("/api/appdetails", STEAM_STORE_API_BASE);
  url.searchParams.set("appids", appIds.join(","));
  url.searchParams.set("filters", STORE_APPDETAILS_FILTERS);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Steam Store metadata request failed with HTTP ${response.status}.`);
  }
  return (await response.json()) as Record<string, unknown>;
}

async function steamGetJson<T>(path: string, params: Record<string, string>) {
  const apiKey = getSteamApiKey();
  if (!apiKey) throw new Error("STEAM_API_KEY is not configured.");

  const url = new URL(path, STEAM_API_BASE);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("format", "json");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 429) {
    throw new Error("Steam API rate limit reached. Try again later.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("Steam API rejected the request. Check the API key and profile privacy.");
  }
  if (!response.ok) {
    throw new Error(`Steam API request failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as T;
}

function extractCustomProfileId(profileUrl: string | null) {
  if (!profileUrl) return null;
  try {
    const url = new URL(profileUrl);
    const [scope, value] = url.pathname.split("/").filter(Boolean);
    return scope === "id" ? value ?? null : null;
  } catch {
    return null;
  }
}

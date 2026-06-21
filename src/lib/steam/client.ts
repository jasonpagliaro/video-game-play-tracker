import { getSteamApiKey } from "@/lib/env";
import { parseSteamIdentifier } from "./identifier";
import {
  buildSteamLibraryPreview,
  type RawSteamOwnedGame,
  type SteamAccountProfile,
  type SteamLibraryPreview,
} from "./library";

const STEAM_API_BASE = "https://api.steampowered.com";

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
  options: { sampleLimit?: number } = {},
): Promise<SteamLibraryPreview> {
  const parsed = parseSteamIdentifier(identifier);
  const steamid64 = parsed.kind === "steamid64" ? parsed.steamid64 : await resolveVanityUrl(parsed.vanity);
  const account = await fetchPlayerSummary(steamid64);
  const games = await fetchOwnedGames(steamid64);

  return buildSteamLibraryPreview({
    identifier,
    account,
    games,
    sampleLimit: options.sampleLimit,
  });
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

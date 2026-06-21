const STEAMID64_BASE = BigInt("76561197960265728");
const STEAMID64_PATTERN = /^\d{17}$/;
const STEAMID2_PATTERN = /^STEAM_[0-5]:([01]):(\d+)$/i;
const STEAMID3_PATTERN = /^\[?U:1:(\d+)\]?$/i;
const VANITY_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;

export type ParsedSteamIdentifier =
  | { kind: "steamid64"; steamid64: string; original: string }
  | { kind: "vanity"; vanity: string; original: string };

export function parseSteamIdentifier(input: string): ParsedSteamIdentifier {
  const original = input.trim();
  if (!original) throw new Error("Enter a Steam ID or Steam profile URL.");

  const urlLike = parseUrlLikeIdentifier(original);
  if (urlLike) return urlLike;

  const steamId64 = parseSteamId64(original);
  if (steamId64) return { kind: "steamid64", steamid64: steamId64, original };

  const steamId2 = parseSteamId2(original);
  if (steamId2) return { kind: "steamid64", steamid64: steamId2, original };

  const steamId3 = parseSteamId3(original);
  if (steamId3) return { kind: "steamid64", steamid64: steamId3, original };

  if (VANITY_PATTERN.test(original)) {
    return { kind: "vanity", vanity: original, original };
  }

  throw new Error("Use a SteamID64, Steam profile URL, vanity URL, SteamID2, SteamID3, or vanity name.");
}

function parseUrlLikeIdentifier(input: string): ParsedSteamIdentifier | null {
  const candidate = input.startsWith("http://") || input.startsWith("https://")
    ? input
    : input.startsWith("steamcommunity.com/")
      ? `https://${input}`
      : null;
  if (!candidate) return null;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Steam profile URL is not valid.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname !== "steamcommunity.com") {
    throw new Error("Only steamcommunity.com profile URLs are supported.");
  }

  const [scope, value] = url.pathname.split("/").filter(Boolean);
  if (!scope || !value) {
    throw new Error("Steam profile URL must include /profiles/:id or /id/:vanity.");
  }

  if (scope.toLowerCase() === "profiles") {
    const steamid64 = parseSteamId64(value);
    if (!steamid64) throw new Error("Steam profile URL has an invalid SteamID64.");
    return { kind: "steamid64", steamid64, original: input };
  }

  if (scope.toLowerCase() === "id") {
    if (!VANITY_PATTERN.test(value)) throw new Error("Steam vanity URL has an invalid profile name.");
    return { kind: "vanity", vanity: value, original: input };
  }

  throw new Error("Only individual Steam profile URLs are supported.");
}

function parseSteamId64(input: string) {
  if (!STEAMID64_PATTERN.test(input)) return null;
  return input;
}

function parseSteamId2(input: string) {
  const match = input.match(STEAMID2_PATTERN);
  if (!match) return null;
  const universeBit = BigInt(match[1]);
  const accountNumber = BigInt(match[2]);
  return (STEAMID64_BASE + accountNumber * BigInt(2) + universeBit).toString();
}

function parseSteamId3(input: string) {
  const match = input.match(STEAMID3_PATTERN);
  if (!match) return null;
  return (STEAMID64_BASE + BigInt(match[1])).toString();
}

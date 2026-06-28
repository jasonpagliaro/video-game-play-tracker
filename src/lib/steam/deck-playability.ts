export const STEAM_DECK_COMPATIBILITY_CATEGORIES = ["unknown", "unsupported", "playable", "verified"] as const;

export type SteamDeckCompatibilityCategory = (typeof STEAM_DECK_COMPATIBILITY_CATEGORIES)[number];

export type SteamDeckCompatibilityItem = {
  status: "info" | "unsupported" | "warning" | "pass";
  label: string;
  locToken: string | null;
  rawDisplayType: number | string | null;
};

export type DeckPlayabilityData = {
  steamDeckCompatibilityCategory: SteamDeckCompatibilityCategory | null;
  steamDeckCompatibilityItems: SteamDeckCompatibilityItem[] | null;
  protondbTier: string | null;
  protondbConfidence: string | null;
  protondbScore: number | null;
  protondbReportCount: number | null;
  deckPlayabilityUpdatedAt: Date | null;
  deckPlayabilityRaw: Record<string, unknown> | null;
};

export const EMPTY_DECK_PLAYABILITY: DeckPlayabilityData = {
  steamDeckCompatibilityCategory: null,
  steamDeckCompatibilityItems: null,
  protondbTier: null,
  protondbConfidence: null,
  protondbScore: null,
  protondbReportCount: null,
  deckPlayabilityUpdatedAt: null,
  deckPlayabilityRaw: null,
};

const STEAM_CATEGORY_BY_NUMBER: Record<number, SteamDeckCompatibilityCategory> = {
  0: "unknown",
  1: "unsupported",
  2: "playable",
  3: "verified",
};

const STEAM_CATEGORY_BY_TEXT: Record<string, SteamDeckCompatibilityCategory> = {
  unknown: "unknown",
  unsupported: "unsupported",
  playable: "playable",
  verified: "verified",
};

const STEAM_CATEGORY_LABELS: Record<SteamDeckCompatibilityCategory, string> = {
  unknown: "Unknown",
  unsupported: "Unsupported",
  playable: "Playable",
  verified: "Verified",
};

const PROTONDB_TIER_LABELS: Record<string, string> = {
  borked: "Borked",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const PROTONDB_TIER_RANK: Record<string, number> = {
  borked: 0,
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

const STEAM_DECK_ITEM_LABELS: Record<string, string> = {
  SteamDeckVerified_TestResult_DefaultConfigurationIsPerformant: "Default configuration performs well",
  SteamDeckVerified_TestResult_DefaultControllerConfigFullyFunctional: "Default controller config works",
  SteamDeckVerified_TestResult_ControllerGlyphsMatchDeckDevice: "Controller glyphs match Steam Deck",
  SteamDeckVerified_TestResult_InterfaceTextIsLegible: "Interface text is legible",
  SteamDeckVerified_TestResult_NativeResolutionNotDefault: "Native resolution is not the default",
  SteamDeckVerified_TestResult_SteamOSDoesNotSupport_VR: "VR is not supported on Steam Deck",
  SteamDeckVerified_TestResult_ExternalControllersNotSupportedPrimaryPlayer: "Primary player needs the built-in controller",
  SteamDeckVerified_TestResult_TextInputDoesNotAutomaticallyInvokesKeyboard:
    "Text input may need manual keyboard access",
  SteamDeckVerified_TestResult_LauncherInteractionIssues: "Launcher may need touchscreen or keyboard interaction",
  SteamDeckVerified_TestResult_SteamOSDoesNotSupport: "SteamOS does not support this game",
  SteamOS_TestResult_GameStartupFunctional: "Game starts on SteamOS",
};

export function normalizeSteamDeckCompatibilityCategory(value: unknown): SteamDeckCompatibilityCategory | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return STEAM_CATEGORY_BY_NUMBER[value] ?? "unknown";

  const numeric = Number(value);
  if (Number.isInteger(numeric) && String(value).trim().match(/^\d+$/)) {
    return STEAM_CATEGORY_BY_NUMBER[numeric] ?? "unknown";
  }

  const normalized = String(value).trim().toLowerCase().replace(/[_-]+/g, " ");
  const token = normalized
    .replace(/^steam deck\s+/, "")
    .replace(/^deck\s+/, "")
    .replace(/\s+/g, "_");
  return STEAM_CATEGORY_BY_TEXT[token] ?? "unknown";
}

export function getSteamDeckCompatibilityCategoryLabel(category: SteamDeckCompatibilityCategory | null | undefined) {
  return category ? STEAM_CATEGORY_LABELS[category] : "Unknown";
}

export function normalizeProtonDbTier(value: unknown) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim().toLowerCase();
  return PROTONDB_TIER_LABELS[normalized] ? normalized : normalized || null;
}

export function getProtonDbTierLabel(tier: string | null | undefined) {
  if (!tier) return "No reports";
  return PROTONDB_TIER_LABELS[tier] ?? titleCase(tier);
}

export function normalizeSteamDeckCompatibilityItem(input: {
  display_type?: unknown;
  loc_token?: unknown;
}): SteamDeckCompatibilityItem {
  const locToken = typeof input.loc_token === "string" && input.loc_token.trim() ? input.loc_token.trim() : null;
  return {
    status: normalizeDisplayType(input.display_type),
    label: locToken ? labelForLocToken(locToken) : "Compatibility note",
    locToken,
    rawDisplayType:
      typeof input.display_type === "number" || typeof input.display_type === "string" ? input.display_type : null,
  };
}

export function hasDeckPlayabilityData(
  game: Pick<
    DeckPlayabilityData,
    "steamDeckCompatibilityCategory" | "steamDeckCompatibilityItems" | "protondbTier" | "protondbReportCount"
  >,
) {
  return Boolean(
    game.steamDeckCompatibilityCategory ||
      (game.steamDeckCompatibilityItems && game.steamDeckCompatibilityItems.length > 0) ||
      game.protondbTier ||
      game.protondbReportCount != null,
  );
}

export function getDeckExperienceLabel(
  game: Pick<DeckPlayabilityData, "steamDeckCompatibilityCategory" | "protondbTier" | "protondbConfidence">,
) {
  const tierRank = protonDbTierRank(game.protondbTier);
  const confidence = game.protondbConfidence?.toLowerCase() ?? null;
  const strongCommunity = tierRank >= 3 && (!confidence || confidence === "strong" || confidence === "moderate");

  if (game.steamDeckCompatibilityCategory === "verified" && strongCommunity) return "Excellent Deck fit";
  if (game.steamDeckCompatibilityCategory === "verified") return "Officially verified";
  if (game.steamDeckCompatibilityCategory === "playable" && strongCommunity) return "Good with minor caveats";
  if (game.steamDeckCompatibilityCategory === "playable") return "Playable with caveats";
  if (game.steamDeckCompatibilityCategory === "unsupported" && tierRank >= 3) return "Community workaround likely";
  if (game.steamDeckCompatibilityCategory === "unsupported") return "Poor Deck fit";
  if (tierRank >= 3) return "Community reports are strong";
  if (tierRank >= 1) return "Community reports are mixed";
  if (game.protondbTier) return "Community reports are poor";
  return "Deck experience unknown";
}

export function formatProtonDbScore(score: number | null | undefined) {
  if (score == null || !Number.isFinite(score)) return "-";
  return `${Math.round(score * 100)}%`;
}

export function formatProtonDbReportCount(count: number | null | undefined) {
  if (count == null) return "-";
  return `${count.toLocaleString("en-US")} ${count === 1 ? "report" : "reports"}`;
}

function normalizeDisplayType(value: unknown): SteamDeckCompatibilityItem["status"] {
  const parsed = typeof value === "number" ? value : Number(value);
  if (parsed === 2) return "unsupported";
  if (parsed === 3) return "warning";
  if (parsed === 4) return "pass";
  return "info";
}

function labelForLocToken(locToken: string) {
  const token = locToken.replace(/^#/, "");
  const mapped = STEAM_DECK_ITEM_LABELS[token];
  if (mapped) return mapped;

  return token
    .replace(/^SteamDeckVerified_TestResult_/, "")
    .replace(/^SteamOS_TestResult_/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

function protonDbTierRank(tier: string | null | undefined) {
  return tier ? PROTONDB_TIER_RANK[tier] ?? -1 : -1;
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

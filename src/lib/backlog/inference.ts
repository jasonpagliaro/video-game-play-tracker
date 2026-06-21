import {
  type BacklogSlot,
  type CompletionType,
  OPEN_ENDED_COMPLETION_TYPES,
} from "./constants";
import { normalizeTitle } from "./normalize";

const liveServiceTerms = [
  "mmo",
  "massively multiplayer",
  "live service",
  "live-service",
  "battle pass",
  "battlepass",
  "extraction shooter",
  "in-app purchases",
  "persistent online",
  "seasonal",
  "season pass",
];
const sandboxTerms = [
  "sandbox",
  "survival",
  "craft",
  "crafting",
  "base building",
  "builder",
  "life sim",
  "simulation",
  "sim",
];
const multiplayerTerms = [
  "multiplayer",
  "multi-player",
  "co-op",
  "coop",
  "cooperative",
  "online co-op",
  "lan co-op",
  "shared/split screen",
  "competitive",
  "pvp",
  "player vs player",
];
const roguelikeTerms = ["roguelike", "roguelite", "rogue-lite", "rogue-like"];
const endlessTerms = ["endless", "open-ended", "open ended", "score attack", "idle", "incremental"];
const horrorTerms = ["horror", "survival horror"];
const puzzleTerms = ["puzzle", "logic", "hidden object", "point and click", "point & click"];
const strategyTerms = [
  "strategy",
  "builder",
  "city builder",
  "colony sim",
  "4x",
  "management",
  "tactics",
  "tactical",
  "deckbuilder",
  "deck-building",
  "card battler",
  "card game",
];
const rpgTerms = ["rpg", "role-playing", "open world", "jrpg", "crpg"];
const narrativeTerms = ["story", "narrative", "visual novel", "interactive fiction", "adventure"];
const actionTerms = [
  "action",
  "combat",
  "shooter",
  "immersive sim",
  "souls",
  "souls-like",
  "platformer",
  "metroidvania",
  "fighting",
  "racing",
  "sports",
  "arcade",
  "beat 'em up",
  "hack and slash",
];
const coopTerms = ["co-op", "coop", "cooperative", "online co-op", "lan co-op", "shared/split screen"];

const knownCompletionTypeOverrides: Record<string, CompletionType> = {
  [normalizeTitle("Arc Raiders")]: "live_service",
  [normalizeTitle("Helldivers 2")]: "live_service",
  [normalizeTitle("Stardew Valley")]: "sandbox",
  [normalizeTitle("Valheim")]: "sandbox",
  [normalizeTitle("Enshrouded")]: "sandbox",
};

function haystack(title: string, tags?: string[] | null, genres?: string[] | null) {
  return [title, ...(tags ?? []), ...(genres ?? [])].join(" ").toLowerCase();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function inferCompletionType(input: {
  title: string;
  tags?: string[] | null;
  genres?: string[] | null;
}): CompletionType {
  const titleOverride = knownCompletionTypeOverrides[normalizeTitle(input.title)];
  if (titleOverride) return titleOverride;

  const text = haystack(input.title, input.tags, input.genres);
  if (includesAny(text, liveServiceTerms)) return "live_service";
  if (includesAny(text, roguelikeTerms)) return "roguelike";
  if (includesAny(text, multiplayerTerms)) return "multiplayer";
  if (includesAny(text, sandboxTerms)) return "sandbox";
  if (includesAny(text, endlessTerms)) return "endless";
  if (
    includesAny(text, [
      ...horrorTerms,
      ...puzzleTerms,
      ...narrativeTerms,
      ...actionTerms,
      ...rpgTerms,
      ...strategyTerms,
    ])
  ) {
    return "completable";
  }
  return "unknown";
}

export function inferBacklogSlot(input: {
  title: string;
  tags?: string[] | null;
  genres?: string[] | null;
  completionType?: CompletionType;
  playtimeMinutes?: number;
}): BacklogSlot {
  const text = haystack(input.title, input.tags, input.genres);
  const completionType = input.completionType ?? inferCompletionType(input);
  if (includesAny(text, horrorTerms)) return "horror";
  if (includesAny(text, puzzleTerms)) return "puzzle";
  if (includesAny(text, strategyTerms)) return "strategy";
  if (includesAny(text, rpgTerms)) return "rpg_long";
  if (includesAny(text, narrativeTerms)) return "narrative";
  if (includesAny(text, actionTerms)) return "action";
  if (includesAny(text, coopTerms)) return "coop";
  if ((input.playtimeMinutes ?? 0) > 0 && (input.playtimeMinutes ?? 0) < 180) {
    return "short";
  }
  if (OPEN_ENDED_COMPLETION_TYPES.includes(completionType)) return "parking_lot";
  return completionType === "unknown" ? "experimental" : "short";
}

export function calculatePriorityScore(input: {
  personalInterest?: "high" | "medium" | "low" | "unknown";
  playtimeMinutes?: number;
  steamReviewScore?: number | null;
  estimatedHours?: number | null;
  completionType?: CompletionType;
  backlogSlot?: BacklogSlot;
}) {
  let score = 50;
  if (input.personalInterest === "high") score += 30;
  if (input.personalInterest === "medium") score += 10;
  if (input.personalInterest === "low") score -= 20;
  if ((input.playtimeMinutes ?? 0) > 0) score += 8;
  if ((input.steamReviewScore ?? 0) >= 90) score += 10;
  if ((input.steamReviewScore ?? 0) >= 80) score += 5;
  if ((input.estimatedHours ?? 0) > 40) score -= 8;
  if (input.completionType === "completable") score += 8;
  if (input.backlogSlot === "parking_lot") score -= 25;
  return Math.max(0, Math.min(100, Math.round(score)));
}

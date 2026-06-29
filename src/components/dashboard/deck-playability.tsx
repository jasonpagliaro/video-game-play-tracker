import { Badge } from "@/components/ui/badge";
import type { GameSummary } from "@/lib/backlog/types";
import {
  formatProtonDbReportCount,
  formatProtonDbScore,
  getDeckExperienceLabel,
  getProtonDbTierLabel,
  getSteamDeckCompatibilityCategoryLabel,
  hasDeckPlayabilityData,
} from "@/lib/steam/deck-playability";
import { cn } from "@/lib/utils";

type DeckPlayabilityGame = Pick<
  GameSummary,
  | "steamDeckCompatibilityCategory"
  | "steamDeckCompatibilityItems"
  | "protondbTier"
  | "protondbConfidence"
  | "protondbScore"
  | "protondbReportCount"
  | "deckPlayabilityUpdatedAt"
>;

export function DeckPlayabilityBadge({ game }: { game: DeckPlayabilityGame }) {
  if (!hasDeckPlayabilityData(game)) return null;

  const category = game.steamDeckCompatibilityCategory;
  const officialCategory = category && category !== "unknown" ? category : null;
  const label = officialCategory
    ? `Steam Deck ${getSteamDeckCompatibilityCategoryLabel(officialCategory)}`
    : game.protondbTier
      ? `ProtonDB ${getProtonDbTierLabel(game.protondbTier)}`
      : "ProtonDB";

  return (
    <Badge
      variant={
        officialCategory === "unsupported" ? "destructive" : officialCategory === "verified" ? "default" : "secondary"
      }
      data-dashboard-deck-badge="playability"
      className="max-w-full"
    >
      <span className="truncate">{label}</span>
    </Badge>
  );
}

export function DeckPlayabilitySummary({
  game,
  className,
  showLabel = false,
}: {
  game: DeckPlayabilityGame;
  className?: string;
  showLabel?: boolean;
}) {
  if (!hasDeckPlayabilityData(game)) return null;

  const parts = [getDeckExperienceLabel(game), getOfficialSteamDeckSummary(game), getProtonDbSummary(game)].filter(
    Boolean,
  );
  if (!parts.length) return null;

  return (
    <div data-dashboard-deck-summary="playability" className={cn("grid min-w-0 gap-1 text-xs", className)}>
      {showLabel ? (
        <span className="text-[10px] font-medium text-muted-foreground">Extra: Steam Deck compatibility</span>
      ) : null}
      <span className="line-clamp-2 text-muted-foreground">{parts.join(" · ")}</span>
    </div>
  );
}

function getOfficialSteamDeckSummary(game: DeckPlayabilityGame) {
  const category = game.steamDeckCompatibilityCategory;
  if (!category || category === "unknown") return null;
  return `Steam Deck: ${getSteamDeckCompatibilityCategoryLabel(category)}`;
}

function getProtonDbSummary(game: DeckPlayabilityGame) {
  if (!game.protondbTier && game.protondbScore == null && game.protondbReportCount == null) return null;

  const parts: string[] = [];
  if (game.protondbTier) parts.push(getProtonDbTierLabel(game.protondbTier));
  const score = formatProtonDbScore(game.protondbScore);
  if (score !== "-") parts.push(score);
  const reports = formatProtonDbReportCount(game.protondbReportCount);
  if (reports !== "-") parts.push(reports);
  return `ProtonDB: ${parts.join(", ")}`;
}

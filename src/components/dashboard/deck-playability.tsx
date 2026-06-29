import { Badge } from "@/components/ui/badge";
import { DeckPlayabilityDialog } from "@/components/dashboard/deck-playability-dialog";
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

type DeckPlayabilityData = Pick<
  GameSummary,
  | "steamDeckCompatibilityCategory"
  | "steamDeckCompatibilityItems"
  | "protondbTier"
  | "protondbConfidence"
  | "protondbScore"
  | "protondbReportCount"
  | "deckPlayabilityUpdatedAt"
>;

type DeckPlayabilityGame = DeckPlayabilityData & Pick<GameSummary, "title">;

export function DeckPlayabilityBadge({ game }: { game: DeckPlayabilityData }) {
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
    (part): part is string => Boolean(part),
  );
  if (!parts.length) return null;

  if (showLabel) {
    return <DeckPlayabilityDialog title={game.title} summaryParts={parts} className={className} />;
  }

  return (
    <div
      data-dashboard-deck-summary="playability"
      className={cn("grid min-w-0 gap-1 text-xs", className)}
    >
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

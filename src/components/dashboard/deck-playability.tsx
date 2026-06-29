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
    (part): part is string => Boolean(part),
  );
  if (!parts.length) return null;

  if (showLabel) {
    const rows = [
      { label: "Fit", value: getDeckExperienceLabel(game) },
      { label: "Steam", value: getOfficialSteamDeckValue(game) },
      { label: "ProtonDB", value: getProtonDbSummaryValue(game) },
    ].filter((row): row is { label: string; value: string } => Boolean(row.value));

    return (
      <div
        data-dashboard-deck-summary="playability"
        className={cn(
          "grid min-w-0 gap-1.5 rounded-md border border-border/60 bg-muted/10 px-2.5 py-2 text-xs",
          className,
        )}
      >
        <span className="truncate text-[10px] font-medium text-muted-foreground">Steam Deck compatibility</span>
        <dl className="grid min-w-0 gap-1">
          {rows.map((row) => (
            <div key={row.label} className="grid min-w-0 grid-cols-[3.625rem_minmax(0,1fr)] items-baseline gap-2">
              <dt className="truncate text-[10px] font-medium text-muted-foreground/75">{row.label}</dt>
              <dd className="truncate text-[11px] leading-snug text-foreground/75">{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
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
  const value = getOfficialSteamDeckValue(game);
  return value ? `Steam Deck: ${value}` : null;
}

function getOfficialSteamDeckValue(game: DeckPlayabilityGame) {
  const category = game.steamDeckCompatibilityCategory;
  if (!category || category === "unknown") return null;
  return getSteamDeckCompatibilityCategoryLabel(category);
}

function getProtonDbSummary(game: DeckPlayabilityGame) {
  const value = getProtonDbSummaryValue(game);
  return value ? `ProtonDB: ${value}` : null;
}

function getProtonDbSummaryValue(game: DeckPlayabilityGame) {
  if (!game.protondbTier && game.protondbScore == null && game.protondbReportCount == null) return null;

  const parts: string[] = [];
  if (game.protondbTier) parts.push(getProtonDbTierLabel(game.protondbTier));
  const score = formatProtonDbScore(game.protondbScore);
  if (score !== "-") parts.push(score);
  const reports = formatProtonDbReportCount(game.protondbReportCount);
  if (reports !== "-") parts.push(reports);
  return parts.join(" · ");
}

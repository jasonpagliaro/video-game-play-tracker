import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatPercent } from "@/lib/backlog/format";
import { getPlaytimeMetrics } from "@/lib/backlog/playtime-metrics";
import type { Game } from "@/lib/backlog/types";
import {
  formatProtonDbReportCount,
  formatProtonDbScore,
  getDeckExperienceLabel,
  getProtonDbTierLabel,
  getSteamDeckCompatibilityCategoryLabel,
  hasDeckPlayabilityData,
} from "@/lib/steam/deck-playability";
import { cn } from "@/lib/utils";

type GameProgressEvidenceGame = Pick<
  Game,
  | "playtimeMinutes"
  | "estimatedHours"
  | "lastPlayed"
  | "backlogSlot"
  | "completionType"
  | "achievementPercent"
  | "lastSyncedAt"
  | "steamReviewScore"
  | "releaseYear"
  | "installed"
  | "currentRotation"
  | "steamDeckCompatibilityCategory"
  | "steamDeckCompatibilityItems"
  | "protondbTier"
  | "protondbConfidence"
  | "protondbScore"
  | "protondbReportCount"
  | "deckPlayabilityUpdatedAt"
>;

export function GameProgressEvidence({ game }: { game: GameProgressEvidenceGame }) {
  const metrics = getPlaytimeMetrics(game);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Steam and progress</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <Detail label="Playtime" value={metrics.played} />
          <Detail label="Progress" value={metrics.progress} />
          <Detail label="Remaining" value={metrics.remaining} />
          <Detail label="Typical finish" value={metrics.typicalFinish} />
          <Detail label="Estimate basis" value={metrics.basis} />
          <Detail label="Last played" value={metrics.lastPlayed} />
          <Detail label="Achievements" value={formatPercent(game.achievementPercent)} />
          <Detail label="Last synced" value={formatDate(game.lastSyncedAt)} />
          <Detail label="Review score" value={game.steamReviewScore?.toString() ?? "-"} />
          <Detail label="Release year" value={game.releaseYear?.toString() ?? "-"} />
          <Detail label="Installed" value={game.installed ? "Yes" : "No"} />
          <Detail label="Current rotation" value={game.currentRotation ? "Yes" : "No"} />
        </CardContent>
      </Card>
      <DeckEvidenceCard game={game} />
    </>
  );
}

function DeckEvidenceCard({ game }: { game: GameProgressEvidenceGame }) {
  const criteria = game.steamDeckCompatibilityItems ?? [];

  return (
    <Card data-game-deck-evidence="playability">
      <CardHeader>
        <CardTitle className="text-base">Deck experience</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {hasDeckPlayabilityData(game) ? (
          <>
            <Detail label="Experience" value={getDeckExperienceLabel(game)} />
            <Detail
              label="Steam"
              value={getSteamDeckCompatibilityCategoryLabel(game.steamDeckCompatibilityCategory)}
            />
            <Detail label="ProtonDB" value={getProtonDbTierLabel(game.protondbTier)} />
            <Detail label="Confidence" value={game.protondbConfidence ? titleCase(game.protondbConfidence) : "-"} />
            <Detail label="Reports" value={formatProtonDbReportCount(game.protondbReportCount)} />
            <Detail label="ProtonDB score" value={formatProtonDbScore(game.protondbScore)} />
            <Detail label="Updated" value={formatDate(game.deckPlayabilityUpdatedAt)} />
            {criteria.length ? (
              <div data-game-deck-criteria="playability" className="grid gap-1.5 border-t border-border/60 pt-2">
                {criteria.map((item, index) => (
                  <div key={`${item.locToken ?? item.label}-${index}`} className="flex min-w-0 items-start gap-2">
                    <span
                      className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", criterionClassName(item.status))}
                    />
                    <span className="min-w-0 text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            No Steam Deck or ProtonDB data yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-xs">{value}</span>
    </div>
  );
}

function criterionClassName(status: string) {
  if (status === "pass") return "bg-primary";
  if (status === "warning") return "bg-amber-500";
  if (status === "unsupported") return "bg-destructive";
  return "bg-muted-foreground";
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

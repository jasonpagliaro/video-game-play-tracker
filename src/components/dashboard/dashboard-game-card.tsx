import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";

import { CompletionTypeBadge, SlotBadge, StatusBadge } from "@/components/badges/game-badges";
import { GameIdentityBanner } from "@/components/dashboard/game-identity-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatMinutes, formatPercent } from "@/lib/backlog/format";
import type { GameSummary } from "@/lib/backlog/types";
import { getSteamIdentityLabel, getSteamStoreUrl } from "@/lib/steam/assets";

export function DashboardGameCard({
  game,
  queuePosition,
  priorityImage = false,
}: {
  game: GameSummary;
  queuePosition?: number;
  priorityImage?: boolean;
}) {
  const steamStoreUrl = getSteamStoreUrl(game.steamAppId);

  return (
    <Card size="sm" className="rounded-lg">
      <GameIdentityBanner steamAppId={game.steamAppId} title={game.title} priority={priorityImage} />
      <CardContent className="grid gap-3 pt-0">
        <div className="grid gap-2">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <Link href={`/games/${game.id}`} className="min-w-0 text-sm font-medium leading-snug hover:underline">
              <span className="line-clamp-2">{game.title}</span>
            </Link>
            {queuePosition ? (
              <Badge variant="secondary" className="font-mono">
                #{queuePosition}
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge status={game.status} />
            <SlotBadge slot={game.backlogSlot} />
            <CompletionTypeBadge completionType={game.completionType} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/60 p-2 text-xs">
          <Metric label="Playtime" value={formatMinutes(game.playtimeMinutes)} />
          <Metric label="Ach" value={formatPercent(game.achievementPercent)} />
          <Metric label="Last" value={formatDate(game.lastPlayed)} />
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate font-mono">{getSteamIdentityLabel(game.steamAppId)}</span>
          <span className="shrink-0">Score {game.priorityScore}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/games/${game.id}`}>
              Open
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          {steamStoreUrl ? (
            <Button asChild size="sm" variant="ghost">
              <a href={steamStoreUrl} target="_blank" rel="noreferrer">
                Steam
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-foreground">{value}</div>
    </div>
  );
}

import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";

import { CompletionTypeBadge, SlotBadge, StatusBadge } from "@/components/badges/game-badges";
import { DeckPlayabilityBadge, DeckPlayabilitySummary } from "@/components/dashboard/deck-playability";
import { DashboardPlaytimeSummary } from "@/components/dashboard/playtime-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GameSummary } from "@/lib/backlog/types";
import { getSteamStoreUrl } from "@/lib/steam/assets";

export function DashboardQueueRow({
  game,
  position,
}: {
  game: GameSummary;
  position: number;
}) {
  const steamStoreUrl = getSteamStoreUrl(game.steamAppId);

  return (
    <div className="grid gap-3 rounded-lg border border-border/70 bg-card/70 p-3 md:grid-cols-[auto_1fr_auto] md:items-center">
      <Badge variant="secondary" className="h-7 w-12 justify-center font-mono">
        #{position}
      </Badge>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link href={`/games/${game.id}`} className="min-w-0 font-medium leading-snug underline-offset-4 hover:underline">
            <span className="line-clamp-1">{game.title}</span>
          </Link>
          <StatusBadge status={game.status} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <DeckPlayabilityBadge game={game} />
          <SlotBadge slot={game.backlogSlot} />
          <CompletionTypeBadge completionType={game.completionType} />
        </div>
        <DeckPlayabilitySummary game={game} className="mt-2" />
        <DashboardPlaytimeSummary game={game} className="mt-2" />
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
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
    </div>
  );
}

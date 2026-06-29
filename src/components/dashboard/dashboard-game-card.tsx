import Link from "next/link";
import { ArrowUpRight, Download, ExternalLink, Play } from "lucide-react";

import { CompletionTypeBadge, SlotBadge, StatusBadge } from "@/components/badges/game-badges";
import { DeckPlayabilityBadge, DeckPlayabilitySummary } from "@/components/dashboard/deck-playability";
import { GameIdentityBanner } from "@/components/dashboard/game-identity-banner";
import { DashboardPlaytimeSummary } from "@/components/dashboard/playtime-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GameSummary } from "@/lib/backlog/types";
import { getSteamInstallUrl, getSteamLaunchUrl, getSteamStoreUrl } from "@/lib/steam/assets";

export function DashboardGameCard({
  game,
  queuePosition,
  priorityImage = false,
  variant = "default",
}: {
  game: GameSummary;
  queuePosition?: number;
  priorityImage?: boolean;
  variant?: "default" | "compact" | "active";
}) {
  const steamStoreUrl = getSteamStoreUrl(game.steamAppId);
  const steamInstallUrl = getSteamInstallUrl(game.steamAppId);
  const steamLaunchUrl = getSteamLaunchUrl(game.steamAppId);

  if (variant === "active") {
    return (
      <Card
        size="sm"
        className="gap-0 rounded-lg border-border/70 bg-card/95 py-0 shadow-sm"
        data-dashboard-card-variant="active"
      >
        <GameIdentityBanner
          steamAppId={game.steamAppId}
          title={game.title}
          priority={priorityImage}
          className="rounded-t-lg border-b border-border/70 bg-background/80"
        />
        <CardContent className="grid gap-3 p-3">
          <div className="grid gap-2">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <Link
                href={`/games/${game.id}`}
                className="min-w-0 text-[15px] font-semibold leading-snug underline-offset-4 hover:underline"
              >
                <span className="line-clamp-2 min-h-[2.4em]">{game.title}</span>
              </Link>
              {queuePosition ? (
                <Badge variant="secondary" className="shrink-0 font-mono">
                  #{queuePosition}
                </Badge>
              ) : null}
            </div>
            <DashboardBadgeStrip game={game} layout="active" />
          </div>
          <DeckPlayabilitySummary
            game={game}
            showLabel
            className="text-muted-foreground"
          />
          <DashboardPlaytimeSummary game={game} className="text-[11px]" />
          <DashboardActiveActions
            game={game}
            steamStoreUrl={steamStoreUrl}
            steamInstallUrl={steamInstallUrl}
            steamLaunchUrl={steamLaunchUrl}
          />
        </CardContent>
      </Card>
    );
  }

  if (variant === "compact") {
    return (
      <Card size="sm" className="rounded-lg" data-dashboard-card-variant="compact">
        <GameIdentityBanner
          steamAppId={game.steamAppId}
          title={game.title}
          priority={priorityImage}
          className="rounded-t-lg"
        />
        <CardContent className="grid gap-2 pt-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <Link href={`/games/${game.id}`} className="min-w-0 text-sm font-medium leading-snug hover:underline">
              <span className="line-clamp-1">{game.title}</span>
            </Link>
            {queuePosition ? (
              <Badge variant="secondary" className="shrink-0 font-mono">
                #{queuePosition}
              </Badge>
            ) : null}
          </div>
          <DashboardBadgeStrip game={game} />
          <DeckPlayabilitySummary
            game={game}
            showLabel
            className="text-muted-foreground"
          />
          <DashboardPlaytimeSummary game={game} />
        </CardContent>
      </Card>
    );
  }

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
          <DashboardBadgeStrip game={game} />
          <DeckPlayabilitySummary
            game={game}
            showLabel
            className="text-muted-foreground"
          />
          <DashboardPlaytimeSummary game={game} />
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

function DashboardActiveActions({
  game,
  steamStoreUrl,
  steamInstallUrl,
  steamLaunchUrl,
}: {
  game: Pick<GameSummary, "id" | "title">;
  steamStoreUrl: string | null;
  steamInstallUrl: string | null;
  steamLaunchUrl: string | null;
}) {
  return (
    <div data-dashboard-actions="active" className="grid gap-1.5 border-t border-border/60 pt-2">
      <div className={steamStoreUrl ? "grid grid-cols-2 gap-1.5" : "grid gap-1.5"}>
        <Button asChild size="sm" variant="outline" className="min-w-0 justify-center gap-1.5 px-2 text-xs">
          <Link href={`/games/${game.id}`} aria-label={`Open ${game.title}`}>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="truncate">Open</span>
          </Link>
        </Button>
        {steamStoreUrl ? (
          <Button asChild size="sm" variant="ghost" className="min-w-0 justify-center gap-1.5 px-2 text-xs">
            <a href={steamStoreUrl} target="_blank" rel="noreferrer" aria-label={`Open ${game.title} on Steam`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">Steam</span>
            </a>
          </Button>
        ) : null}
      </div>
      {steamInstallUrl && steamLaunchUrl ? (
        <div className="grid grid-cols-2 gap-1.5">
          <Button asChild size="sm" variant="outline" className="min-w-0 justify-center gap-1.5 px-2 text-xs">
            <a href={steamInstallUrl} aria-label={`Install ${game.title} in Steam`}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">Install</span>
            </a>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-w-0 justify-center gap-1.5 px-2 text-xs">
            <a href={steamLaunchUrl} aria-label={`Launch ${game.title} in Steam`}>
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">Launch</span>
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DashboardBadgeStrip({
  game,
  layout = "default",
}: {
  game: Pick<
    GameSummary,
    | "status"
    | "backlogSlot"
    | "completionType"
    | "steamDeckCompatibilityCategory"
    | "steamDeckCompatibilityItems"
    | "protondbTier"
    | "protondbConfidence"
    | "protondbScore"
    | "protondbReportCount"
    | "deckPlayabilityUpdatedAt"
  >;
  layout?: "default" | "active";
}) {
  if (layout === "active") {
    return (
      <div data-dashboard-badge-strip="active" className="grid min-h-[2.625rem] content-start gap-1.5 overflow-hidden">
        <div data-dashboard-badge-row="state" className="flex min-w-0 flex-nowrap gap-1.5 overflow-hidden">
          <StatusBadge status={game.status} />
          <CompletionTypeBadge completionType={game.completionType} />
        </div>
        <div data-dashboard-badge-row="slot" className="flex min-w-0 gap-1.5 overflow-hidden">
          <SlotBadge slot={game.backlogSlot} />
        </div>
      </div>
    );
  }

  return (
    <div
      data-dashboard-badge-strip="default"
      className="flex min-h-[2.875rem] flex-wrap content-start gap-1.5 overflow-hidden"
    >
      <StatusBadge status={game.status} />
      <DeckPlayabilityBadge game={game} />
      <SlotBadge slot={game.backlogSlot} />
      <CompletionTypeBadge completionType={game.completionType} />
    </div>
  );
}

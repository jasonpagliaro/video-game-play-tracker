import Link from "next/link";
import { ArrowUpRight, ChevronDown, Download, ExternalLink, Play } from "lucide-react";

import { CompletionTypeBadge, SlotBadge, StatusBadge } from "@/components/badges/game-badges";
import { DashboardDeckPlayabilityDetails, DeckPlayabilityBadge } from "@/components/dashboard/deck-playability";
import { GameIdentityBanner } from "@/components/dashboard/game-identity-banner";
import { DashboardPlaytimeDetails } from "@/components/dashboard/playtime-details";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GameSummary } from "@/lib/backlog/types";
import { getSteamIdentityLabel, getSteamInstallUrl, getSteamLaunchUrl, getSteamStoreUrl } from "@/lib/steam/assets";
import { cn } from "@/lib/utils";

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
      <Card size="sm" className="gap-2 rounded-lg py-2" data-dashboard-card-variant="active">
        <GameIdentityBanner
          steamAppId={game.steamAppId}
          title={game.title}
          priority={priorityImage}
          className="rounded-t-lg"
        />
        <CardContent className="grid gap-2 pt-0">
          <div className="grid gap-1.5">
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
            <DashboardBadgeStrip game={game} layout="active" />
          </div>

          <div className="grid gap-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono">{getSteamIdentityLabel(game.steamAppId)}</span>
              <span className="shrink-0">Score {game.priorityScore}</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/games/${game.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                Open
              </Link>
              {steamStoreUrl ? (
                <a href={steamStoreUrl} target="_blank" rel="noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Steam
                </a>
              ) : null}
            </div>
          </div>
          <DashboardPlaytimeDetails game={game} metricsClassName="text-[11px]" />
          <DashboardDeckPlayabilityDetails game={game} metricsClassName="text-[11px]" />
          {steamInstallUrl && steamLaunchUrl ? (
            <div data-dashboard-actions="active" className="grid grid-cols-2 gap-1.5">
              <Button asChild size="sm" variant="outline" className="min-w-0 px-2 text-xs">
                <a href={steamInstallUrl} aria-label={`Install ${game.title} in Steam`}>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="truncate">Install</span>
                </a>
              </Button>
              <Button asChild size="sm" variant="outline" className="min-w-0 px-2 text-xs">
                <a href={steamLaunchUrl} aria-label={`Launch ${game.title} in Steam`}>
                  <Play className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="truncate">Launch</span>
                </a>
              </Button>
            </div>
          ) : null}
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
        </div>

        <details className="group/details grid gap-3">
          <summary
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-full cursor-pointer list-none justify-between px-0 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden",
            )}
          >
            <span>Details</span>
            <ChevronDown
              className="h-3.5 w-3.5 transition-transform group-open/details:rotate-180"
              aria-hidden="true"
            />
          </summary>

          <div className="grid gap-3">
            <DashboardPlaytimeDetails game={game} />
            <DashboardDeckPlayabilityDetails game={game} />

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
          </div>
        </details>
      </CardContent>
    </Card>
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
      <div data-dashboard-badge-strip="active" className="grid min-h-[2.875rem] content-start gap-1.5 overflow-hidden">
        <div data-dashboard-badge-row="state" className="flex min-w-0 flex-nowrap gap-1.5 overflow-hidden">
          <StatusBadge status={game.status} />
          <CompletionTypeBadge completionType={game.completionType} />
        </div>
        <div data-dashboard-badge-row="slot" className="flex min-w-0 gap-1.5 overflow-hidden">
          <SlotBadge slot={game.backlogSlot} />
          <DeckPlayabilityBadge game={game} />
        </div>
      </div>
    );
  }

  return (
    <div data-dashboard-badge-strip="default" className="flex min-h-[2.875rem] flex-wrap content-start gap-1.5 overflow-hidden">
      <StatusBadge status={game.status} />
      <SlotBadge slot={game.backlogSlot} />
      <CompletionTypeBadge completionType={game.completionType} />
      <DeckPlayabilityBadge game={game} />
    </div>
  );
}

import Link from "next/link";

import { CompletionTypeBadge, SlotBadge, StatusBadge, SyncStateBadge } from "@/components/badges/game-badges";
import { GameDetailEditor } from "@/components/backlog/game-detail-editor";
import { PageHeader } from "@/components/backlog/page-header";
import { StatusHistoryTimeline } from "@/components/backlog/status-history-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMinutes, formatPercent } from "@/lib/backlog/format";
import { requireUser } from "@/lib/auth";
import { getGame, getGames, getGameStatusHistory, getSettings } from "@/lib/db/repository";

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [game, settings, games, statusHistory] = await Promise.all([
    getGame(user, id),
    getSettings(user),
    getGames(user),
    getGameStatusHistory(user, id),
  ]);
  if (!game) {
    return (
      <div className="grid gap-4 p-4 lg:p-6">
        <PageHeader title="Game not found" />
        <Button asChild variant="outline">
          <Link href="/backlog">Back to backlog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader title={game.title} description={game.steamAppId ? `Steam App ${game.steamAppId}` : "Manual or unmatched game"} />
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={game.status} />
        <SlotBadge slot={game.backlogSlot} />
        <CompletionTypeBadge completionType={game.completionType} />
        <SyncStateBadge syncState={game.syncState} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <GameDetailEditor
          key={`${game.id}-${game.updatedAt.toISOString()}`}
          game={game}
          settings={settings}
          activeGames={games.filter((item) => item.currentRotation)}
        />
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Steam and progress</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <Detail label="Playtime" value={formatMinutes(game.playtimeMinutes)} />
              <Detail label="Achievements" value={formatPercent(game.achievementPercent)} />
              <Detail label="Estimated hours" value={game.estimatedHours ? `${game.estimatedHours}h` : "-"} />
              <Detail label="Last played" value={formatDate(game.lastPlayed)} />
              <Detail label="Last synced" value={formatDate(game.lastSyncedAt)} />
              <Detail label="Review score" value={game.steamReviewScore?.toString() ?? "-"} />
              <Detail label="Release year" value={game.releaseYear?.toString() ?? "-"} />
              <Detail label="Installed" value={game.installed ? "Yes" : "No"} />
              <Detail label="Current rotation" value={game.currentRotation ? "Yes" : "No"} />
            </CardContent>
          </Card>
          <StatusHistoryTimeline history={statusHistory} />
        </div>
      </div>
    </div>
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

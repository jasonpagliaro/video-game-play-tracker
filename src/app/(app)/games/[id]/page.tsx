import Link from "next/link";

import { CompletionTypeBadge, SlotBadge, StatusBadge, SyncStateBadge } from "@/components/badges/game-badges";
import { GameDetailEditor } from "@/components/backlog/game-detail-editor";
import { GameProgressEvidence } from "@/components/backlog/game-progress-evidence";
import { PageHeader } from "@/components/backlog/page-header";
import { StatusHistoryTimeline } from "@/components/backlog/status-history-timeline";
import { Button } from "@/components/ui/button";
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
          <GameProgressEvidence game={game} />
          <StatusHistoryTimeline history={statusHistory} />
        </div>
      </div>
    </div>
  );
}

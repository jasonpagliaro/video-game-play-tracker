import { GameTable } from "@/components/backlog/game-table";
import { PageHeader } from "@/components/backlog/page-header";
import { QueueBalancePanel } from "@/components/queue/queue-balance-panel";
import { WarningPanel } from "@/components/warnings/warning-panel";
import { requireUser } from "@/lib/auth";
import { summarizeWarnings } from "@/lib/backlog/warnings";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function QueuePage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  const queued = games.filter((game) => game.queueRank != null).sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader title="Next Up Queue" description="Ranked queue with category-aware balancing and friendly move controls." />
      <WarningPanel warnings={summarizeWarnings(games, settings).filter((warning) => warning.code.includes("queue"))} />
      <QueueBalancePanel games={games} />
      <GameTable games={queued} settings={settings} view="queue" showQueueControls />
    </div>
  );
}

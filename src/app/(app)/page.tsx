import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { GameTable } from "@/components/backlog/game-table";
import { PageHeader } from "@/components/backlog/page-header";
import { MetricStrip } from "@/components/dashboard/metric-strip";
import { QueueBalancePanel } from "@/components/queue/queue-balance-panel";
import { WarningPanel } from "@/components/warnings/warning-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { formatMinutes } from "@/lib/backlog/format";
import { summarizeWarnings } from "@/lib/backlog/warnings";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function DashboardPage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  const active = games.filter((game) => game.currentRotation);
  const queued = games.filter((game) => game.queueRank != null).sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));
  const completed = games.filter((game) => game.status === "completed").length;
  const dnf = games.filter((game) => game.status === "dnf").length;
  const parked = games.filter((game) => game.status === "parked").length;
  const installed = games.filter((game) => game.installed).length;
  const importedReview = games.filter((game) => game.syncState === "imported" && game.queueRank == null && !game.currentRotation).length;
  const warnings = summarizeWarnings(games, settings);

  return (
    <div className="grid gap-5 p-4 lg:p-6">
      <PageHeader
        title="Dashboard"
        description="Active execution state, queue health, and backlog pressure at a glance."
        actions={
          <Button asChild>
            <Link href="/import">
              Import CSV
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <MetricStrip
        metrics={[
          { label: "Active rotation", value: `${active.length}/${settings.maxActiveRotationCount}`, detail: "Configured active limit" },
          { label: "Installed", value: installed, detail: settings.maxInstalledCount ? `Limit ${settings.maxInstalledCount}` : "No warning limit" },
          { label: "Completed", value: completed, detail: `${formatMinutes(games.reduce((sum, game) => sum + game.playtimeMinutes, 0))} tracked` },
          { label: "DNF / Parked", value: `${dnf}/${parked}`, detail: `${importedReview} new imports need review` },
        ]}
      />
      <WarningPanel warnings={warnings} />
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current active rotation</CardTitle>
          </CardHeader>
          <CardContent>
            <GameTable games={active} settings={settings} view="rotation" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next up</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {queued.slice(0, 8).map((game) => (
                <div key={game.id} className="grid grid-cols-[48px_1fr] gap-3 rounded-md border border-border p-3 text-sm">
                  <div className="font-mono text-muted-foreground">{game.queueRank ?? "-"}</div>
                  <div>
                    <Link href={`/games/${game.id}`} className="font-medium hover:underline">
                      {game.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">{game.backlogSlot} - {game.completionType}</div>
                  </div>
                </div>
              ))}
              {queued.length === 0 ? <div className="text-sm text-muted-foreground">No queued games yet.</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
      <QueueBalancePanel games={games} />
    </div>
  );
}


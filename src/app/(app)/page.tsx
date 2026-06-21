import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/backlog/page-header";
import { DashboardGameCard } from "@/components/dashboard/dashboard-game-card";
import { DashboardQueueStatus } from "@/components/dashboard/dashboard-queue-status";
import { DashboardStatusGrid } from "@/components/dashboard/dashboard-status-grid";
import { WarningPanel } from "@/components/warnings/warning-panel";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/backlog/dashboard";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function DashboardPage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  const summary = getDashboardSummary(games, settings);

  return (
    <div className="grid gap-5 p-4 lg:p-6">
      <PageHeader
        title="Dashboard"
        description="Active execution state, queue health, and backlog pressure at a glance."
        actions={
          <Button asChild>
            <Link href="/import">
              Import / sync
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />
      <DashboardStatusGrid summary={summary} settings={settings} />
      <WarningPanel warnings={summary.warnings} />
      <DashboardSection
        title="Current active rotation"
        href="/rotation"
        empty="No active games in rotation."
        cardGridClassName="md:grid-cols-2 xl:grid-cols-3"
      >
        {summary.activeGames.map((game, index) => (
          <DashboardGameCard key={game.id} game={game} priorityImage={index < 2} />
        ))}
      </DashboardSection>
      <DashboardQueueStatus summary={summary} />
      <DashboardSection
        title="Next up"
        href="/queue"
        empty="No queued games yet."
        cardGridClassName="md:grid-cols-2 xl:grid-cols-4"
      >
        {summary.nextWindowGames.map((game, index) => (
          <DashboardGameCard key={game.id} game={game} queuePosition={index + 1} priorityImage={index < 2} />
        ))}
      </DashboardSection>
    </div>
  );
}

function DashboardSection({
  title,
  href,
  empty,
  children,
  cardGridClassName = "md:grid-cols-2",
}: {
  title: string;
  href: string;
  empty: string;
  children: ReactNode;
  cardGridClassName?: string;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={href}>
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
      <div className={`grid gap-3 ${cardGridClassName}`}>
        {children}
      </div>
      {Array.isArray(children) && children.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">{empty}</div>
      ) : null}
    </section>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DashboardGameCard } from "@/components/dashboard/dashboard-game-card";
import { DashboardOverviewStrip } from "@/components/dashboard/dashboard-overview-strip";
import { DashboardQueueStatus } from "@/components/dashboard/dashboard-queue-status";
import { RotationFillPanel } from "@/components/rotation/rotation-fill-panel";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/backlog/dashboard";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function DashboardPage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  const summary = getDashboardSummary(games, settings);

  return (
    <div className="grid gap-3 p-3 lg:p-4 xl:p-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-normal">Dashboard</h1>
          <p className="mt-0.5 hidden max-w-3xl truncate text-xs text-muted-foreground sm:block">
            Active execution state, queue health, and backlog pressure at a glance.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/import">
            Import / sync
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </header>
      <DashboardOverviewStrip summary={summary} settings={settings} />
      <DashboardSection
        title="Current active rotation"
        href="/rotation"
        empty="No active games in rotation."
        cardGridClassName="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      >
        {summary.activeGames.map((game, index) => (
          <DashboardGameCard key={game.id} game={game} priorityImage={index < 5} variant="compact" />
        ))}
      </DashboardSection>
      <DashboardQueueStatus summary={summary} />
      <RotationFillPanel games={games} settings={settings} />
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
    <section className="grid gap-2">
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

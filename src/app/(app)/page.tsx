import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { DashboardActiveHealth } from "@/components/dashboard/dashboard-active-health";
import { DashboardGameCard } from "@/components/dashboard/dashboard-game-card";
import { DashboardOverviewStrip } from "@/components/dashboard/dashboard-overview-strip";
import { DashboardQueueStatus } from "@/components/dashboard/dashboard-queue-status";
import { DashboardQueueRow } from "@/components/dashboard/dashboard-queue-row";
import { RotationFillPanel } from "@/components/rotation/rotation-fill-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/backlog/dashboard";
import type { GameSummary } from "@/lib/backlog/types";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function DashboardPage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  const summary = getDashboardSummary(games, settings);

  return (
    <div className="grid gap-3 p-3 lg:p-4 xl:p-5">
      <section className="grid min-h-[calc(100svh-1.5rem)] content-start gap-3 lg:min-h-[calc(100svh-2rem)] xl:min-h-[calc(100svh-2.5rem)]">
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
            <DashboardGameCard key={game.id} game={game} priorityImage={index < 5} variant="active" />
          ))}
          {Array.from({ length: summary.active.openSlots }, (_, index) => (
            <OpenSlotCard key={`open-slot-${index}`} slotNumber={summary.counts.active + index + 1} />
          ))}
        </DashboardSection>
        <DashboardActiveHealth summary={summary} settings={settings} />
      </section>
      <section className="grid gap-3 pt-3" aria-label="Upcoming games and queue planning">
        <DashboardQueueStatus summary={summary} />
        <RotationFillPanel games={games} settings={settings} />
        <DashboardQueueRowsSection games={summary.nextWindowGames} />
      </section>
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

function OpenSlotCard({ slotNumber }: { slotNumber: number }) {
  return (
    <Card size="sm" className="min-h-40 gap-2 rounded-lg border-dashed bg-muted/20 py-2">
      <CardContent className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background">
          <Plus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <div className="text-sm font-medium">Open slot {slotNumber}</div>
          <div className="mt-1 text-xs text-muted-foreground">Ready for the next rotation pick</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardQueueRowsSection({ games }: { games: GameSummary[] }) {
  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Next up</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/queue">
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
      <div className="grid gap-2">
        {games.length ? (
          games.map((game, index) => <DashboardQueueRow key={game.id} game={game} position={index + 1} />)
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            No queued games yet.
          </div>
        )}
      </div>
    </section>
  );
}

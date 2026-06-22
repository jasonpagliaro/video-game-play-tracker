import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Gauge, RotateCw, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/lib/backlog/dashboard";
import { formatMinutes, formatPercent } from "@/lib/backlog/format";
import type { AppSettings } from "@/lib/backlog/types";

export function DashboardActiveHealth({
  summary,
  settings,
}: {
  summary: DashboardSummary;
  settings: AppSettings;
}) {
  const primaryWarning = summary.active.primaryWarning;
  const WarningIcon = primaryWarning ? AlertTriangle : CheckCircle2;
  const activeItems = [
    {
      label: "Open slots",
      value: summary.active.openSlots.toString(),
      detail: `${summary.counts.active}/${settings.maxActiveRotationCount} active`,
      icon: RotateCw,
    },
    {
      label: "Recently played",
      value: summary.active.recentlyPlayedCount.toString(),
      detail: `${summary.active.staleCount} stale`,
      icon: Clock3,
    },
    {
      label: "Active playtime",
      value: formatMinutes(summary.active.totalPlaytimeMinutes),
      detail: "tracked in rotation",
      icon: Gauge,
    },
    {
      label: "Achievements",
      value: `${summary.active.achievementTrackedCount}/${summary.counts.active}`,
      detail: `${formatPercent(summary.active.achievementAveragePercent)} avg; ${formatPercent(
        summary.active.achievementCoveragePercent,
      )} covered`,
      icon: Trophy,
    },
  ];

  return (
    <Card className="rounded-lg xl:sticky xl:top-4">
      <CardHeader>
        <CardTitle className="text-base">Rotation health</CardTitle>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/rotation">Open</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {activeItems.map((item) => (
            <div key={item.label} className="rounded-md border border-border/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
                <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="mt-2 font-mono text-xl font-semibold">{item.value}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</div>
            </div>
          ))}
        </div>
        <div className="flex min-w-0 items-start gap-2 rounded-md bg-muted/45 p-3">
          <WarningIcon
            className={primaryWarning ? "mt-0.5 h-4 w-4 shrink-0 text-amber-300" : "mt-0.5 h-4 w-4 shrink-0 text-emerald-300"}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {primaryWarning ? primaryWarning.title : "Active rotation looks balanced"}
            </div>
            <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {primaryWarning
                ? primaryWarning.detail
                : "No active rotation rule warnings are currently raised."}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

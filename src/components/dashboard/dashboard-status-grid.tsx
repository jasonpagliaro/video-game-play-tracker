import { Archive, CheckCircle2, CircleSlash, HardDrive, RotateCw } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatMinutes } from "@/lib/backlog/format";
import type { DashboardSummary } from "@/lib/backlog/dashboard";
import type { AppSettings } from "@/lib/backlog/types";

export function DashboardStatusGrid({
  summary,
  settings,
}: {
  summary: DashboardSummary;
  settings: AppSettings;
}) {
  const items = [
    {
      label: "Rotation",
      value: `${summary.counts.active}/${settings.maxActiveRotationCount}`,
      detail: "active limit",
      icon: RotateCw,
    },
    {
      label: "Installed",
      value: summary.counts.installed.toString(),
      detail: settings.maxInstalledCount ? `limit ${settings.maxInstalledCount}` : "no warning limit",
      icon: HardDrive,
    },
    {
      label: "Finished",
      value: `${summary.counts.completed}/${summary.counts.doneForNow}`,
      detail: "completed / done for now",
      icon: CheckCircle2,
    },
    {
      label: "DNF / Parked",
      value: `${summary.counts.dnf}/${summary.counts.parked}`,
      detail: `${summary.counts.doneForNowCandidates} done-for-now candidates`,
      icon: CircleSlash,
    },
    {
      label: "Library",
      value: `${summary.counts.totalGames} / ${summary.queue.total}`,
      detail: `${summary.counts.steamIdentified} Steam IDs; ${formatMinutes(summary.counts.totalPlaytimeMinutes)} tracked`,
      icon: Archive,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label} size="sm" className="rounded-lg">
          <CardContent className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
              <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <div className="font-mono text-2xl font-semibold">{item.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

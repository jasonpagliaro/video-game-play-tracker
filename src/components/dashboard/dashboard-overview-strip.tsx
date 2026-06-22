import { AlertTriangle, Archive, CheckCircle2, CircleSlash, HardDrive, Info, RotateCw } from "lucide-react";

import { formatMinutes } from "@/lib/backlog/format";
import type { DashboardSummary } from "@/lib/backlog/dashboard";
import type { AppSettings } from "@/lib/backlog/types";

export function DashboardOverviewStrip({
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
      detail: "active",
      icon: RotateCw,
    },
    {
      label: "Installed",
      value: summary.counts.installed.toString(),
      detail: settings.maxInstalledCount ? `limit ${settings.maxInstalledCount}` : "no limit",
      icon: HardDrive,
    },
    {
      label: "Finished",
      value: `${summary.counts.completed}/${summary.counts.doneForNow}`,
      detail: "done",
      icon: CheckCircle2,
    },
    {
      label: "DNF / Parked",
      value: `${summary.counts.dnf}/${summary.counts.parked}`,
      detail: `${summary.counts.doneForNowCandidates} candidates`,
      icon: CircleSlash,
    },
    {
      label: "Library",
      value: summary.counts.totalGames.toString(),
      detail: formatMinutes(summary.counts.totalPlaytimeMinutes),
      icon: Archive,
    },
  ];
  const primaryWarning = summary.warnings[0];
  const WarningIcon = primaryWarning ? AlertTriangle : Info;

  return (
    <section className="rounded-lg border border-border/70 bg-card/60 p-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(18rem,1.2fr)]">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 items-center gap-2 rounded-md bg-muted/35 px-2.5 py-2">
            <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-xs text-muted-foreground">{item.label}</span>
                <span className="font-mono text-base font-semibold leading-none">{item.value}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">{item.detail}</div>
            </div>
          </div>
        ))}
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-border/70 px-2.5 py-2 sm:col-span-2 lg:col-span-3 xl:col-span-1">
          <WarningIcon
            className={primaryWarning ? "h-4 w-4 shrink-0 text-amber-300" : "h-4 w-4 shrink-0 text-muted-foreground"}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">
              {primaryWarning ? primaryWarning.title : "No execution warnings"}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {primaryWarning
                ? primaryWarning.detail
                : "Rotation, install count, active variety, and queue variety are within current rules."}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

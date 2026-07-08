import type { DashboardSummary } from "@/lib/backlog/dashboard";
import { cn } from "@/lib/utils";

export function getLibraryQueueMetric(summary: DashboardSummary) {
  const libraryTotal = summary.counts.totalGames;
  const queuedTotal = summary.queue.total;
  const queuedPercent = libraryTotal > 0 ? Math.min(100, Math.max(0, (queuedTotal / libraryTotal) * 100)) : 0;
  const clearPercent = libraryTotal > 0 ? Math.max(0, 100 - queuedPercent) : 100;

  return {
    value: `${queuedTotal} / ${libraryTotal}`,
    ratioLabel: "in queue / library",
    clearPercent,
    clearPercentLabel: formatProgressPercent(clearPercent),
  };
}

export function LibraryQueueProgress({
  summary,
  className,
}: {
  summary: DashboardSummary;
  className?: string;
}) {
  const metric = getLibraryQueueMetric(summary);
  const ariaValueNow = Number(metric.clearPercent.toFixed(1));

  return (
    <div className={cn("grid gap-1", className)} data-dashboard-library-queue="progress">
      <div className="flex items-center justify-between gap-2 text-[0.6875rem] leading-none text-muted-foreground">
        <span>{metric.clearPercentLabel} clear</span>
        <span>100% at empty queue</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Progress toward empty queue"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ariaValueNow}
        aria-valuetext={`${metric.clearPercentLabel} clear`}
      >
        <div className="h-full rounded-full bg-emerald-300" style={{ width: `${metric.clearPercent}%` }} />
      </div>
    </div>
  );
}

function formatProgressPercent(percent: number) {
  if (percent <= 0) return "0%";
  if (percent >= 100) return "100%";
  if (percent < 1) return "<1%";
  if (percent < 10) return `${formatOneDecimal(percent)}%`;

  return `${Math.round(percent)}%`;
}

function formatOneDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

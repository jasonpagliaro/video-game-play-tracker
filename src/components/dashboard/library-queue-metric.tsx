import type { DashboardSummary } from "@/lib/backlog/dashboard";
import { cn } from "@/lib/utils";

export function getLibraryQueueMetric(summary: DashboardSummary) {
  const libraryTotal = summary.counts.totalGames;
  const queuedTotal = summary.queue.total;
  const percent = libraryTotal > 0 ? Math.min(100, Math.max(0, (queuedTotal / libraryTotal) * 100)) : 0;

  return {
    value: `${queuedTotal} / ${libraryTotal}`,
    ratioLabel: "in queue / library",
    percent,
    percentLabel: formatQueuePercent(percent, queuedTotal),
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
  const ariaValueNow = Number(metric.percent.toFixed(1));

  return (
    <div className={cn("grid gap-1", className)} data-dashboard-library-queue="progress">
      <div className="flex items-center justify-between gap-2 text-[0.6875rem] leading-none text-muted-foreground">
        <span>{metric.percentLabel} queued</span>
        <span>0% is clear</span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Library queue share"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ariaValueNow}
        aria-valuetext={`${metric.percentLabel} queued`}
      >
        <div className="h-full rounded-full bg-amber-300" style={{ width: `${metric.percent}%` }} />
      </div>
    </div>
  );
}

function formatQueuePercent(percent: number, queuedTotal: number) {
  if (queuedTotal === 0 || percent === 0) return "0%";
  if (percent < 1) return "<1%";
  if (percent < 10) return `${formatOneDecimal(percent)}%`;

  return `${Math.round(percent)}%`;
}

function formatOneDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

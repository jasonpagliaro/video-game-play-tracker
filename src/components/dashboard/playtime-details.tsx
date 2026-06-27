import { ChevronDown } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { getPlaytimeMetrics } from "@/lib/backlog/playtime-metrics";
import type { GameSummary } from "@/lib/backlog/types";
import { cn } from "@/lib/utils";

export function DashboardPlaytimeDetails({
  game,
  className,
  metricsClassName,
}: {
  game: Pick<GameSummary, "playtimeMinutes" | "estimatedHours" | "lastPlayed" | "backlogSlot" | "completionType">;
  className?: string;
  metricsClassName?: string;
}) {
  const metrics = getPlaytimeMetrics(game);

  return (
    <details data-dashboard-playtime-details="playtime" className={cn("group/playtime grid gap-2", className)}>
      <summary
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "w-full cursor-pointer list-none justify-between px-0 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden",
        )}
      >
        <span>Play time</span>
        <ChevronDown
          className="h-3.5 w-3.5 transition-transform group-open/playtime:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div
        data-dashboard-playtime-metrics="playtime"
        className={cn("grid grid-cols-2 gap-2 rounded-md bg-muted/60 p-2 text-xs", metricsClassName)}
      >
        <Metric label="Played" value={metrics.played} />
        <Metric label="Typical" value={metrics.typicalFinish} />
        <Metric label="Remaining" value={metrics.remaining} />
        <Metric label="Progress" value={metrics.progress} />
        <Metric label="Last played" value={metrics.lastPlayed} />
        <Metric label="Basis" value={metrics.basis} />
      </div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-foreground">{value}</div>
    </div>
  );
}

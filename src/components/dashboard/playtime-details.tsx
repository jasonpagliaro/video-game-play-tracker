import { getPlaytimeMetrics } from "@/lib/backlog/playtime-metrics";
import type { GameSummary } from "@/lib/backlog/types";
import { cn } from "@/lib/utils";

export function DashboardPlaytimeSummary({
  game,
  className,
}: {
  game: Pick<GameSummary, "playtimeMinutes" | "estimatedHours" | "lastPlayed" | "backlogSlot" | "completionType">;
  className?: string;
}) {
  const metrics = getPlaytimeMetrics(game);
  const chips = getSummaryChips(metrics);

  return (
    <div
      data-dashboard-playtime-summary="playtime"
      className={cn("grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-3", className)}
    >
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="grid min-w-0 gap-0.5 rounded-md border border-border/60 bg-muted/25 px-2 py-1.5"
        >
          <span className="truncate text-[10px] font-medium text-muted-foreground">{chip.label}</span>
          <span className="truncate font-mono text-[12px] leading-tight text-foreground">{chip.value}</span>
        </span>
      ))}
    </div>
  );
}

function getSummaryChips(metrics: ReturnType<typeof getPlaytimeMetrics>) {
  const chips = [{ label: "Played", value: metrics.played }];
  const estimateMet = metrics.remaining === "At / over estimate";

  if (metrics.progress !== "-") {
    chips.push({ label: "Progress", value: estimateMet ? "100%+" : metrics.progress });
  }

  if (metrics.remaining === "Ongoing") {
    chips.push({ label: "Status", value: "Ongoing" });
  } else if (estimateMet) {
    chips.push({ label: "Remaining", value: "Estimate met" });
  } else if (metrics.remaining !== "-") {
    chips.push({ label: "Remaining", value: metrics.remaining });
  }

  return chips;
}

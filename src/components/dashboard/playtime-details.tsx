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
    <div data-dashboard-playtime-summary="playtime" className={cn("flex flex-wrap gap-1.5 text-xs", className)}>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-border/60 bg-muted/35 px-1.5 py-1 text-muted-foreground"
        >
          <span className="truncate">{chip.label}</span>
          <span className="truncate font-mono text-foreground">{chip.value}</span>
        </span>
      ))}
    </div>
  );
}

function getSummaryChips(metrics: ReturnType<typeof getPlaytimeMetrics>) {
  const chips = [{ label: "Played", value: metrics.played }];

  if (metrics.progress !== "-") {
    chips.push({ label: "Progress", value: metrics.progress });
  }

  if (metrics.remaining === "Ongoing") {
    chips.push({ label: "Status", value: "Ongoing" });
  } else if (metrics.remaining === "At / over estimate") {
    chips.push({ label: "Remaining", value: "At / over" });
  } else if (metrics.remaining !== "-") {
    chips.push({ label: "Remaining", value: metrics.remaining });
  }

  return chips;
}

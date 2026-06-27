"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { getPlaytimeMetrics } from "@/lib/backlog/playtime-metrics";
import type { GameSummary } from "@/lib/backlog/types";
import { cn } from "@/lib/utils";

type PlaytimeDetailsContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const PlaytimeDetailsContext = createContext<PlaytimeDetailsContextValue | null>(null);

export function DashboardPlaytimeDetailsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <PlaytimeDetailsContext.Provider value={{ open, setOpen }}>
      {children}
    </PlaytimeDetailsContext.Provider>
  );
}

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
  const detailsId = useId();
  const context = useContext(PlaytimeDetailsContext);
  const [localOpen, setLocalOpen] = useState(false);
  const open = context?.open ?? localOpen;
  const setOpen = context?.setOpen ?? setLocalOpen;

  return (
    <div data-dashboard-playtime-details="playtime" className={cn("grid gap-2", className)}>
      <button
        type="button"
        aria-controls={detailsId}
        aria-expanded={open}
        aria-label={open ? "Hide play time details" : "Show play time details"}
        onClick={() => setOpen(!open)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "w-full cursor-pointer justify-between px-0 text-muted-foreground hover:text-foreground",
        )}
      >
        <span>Play time</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-180" : null)}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={detailsId}
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
      ) : null}
    </div>
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

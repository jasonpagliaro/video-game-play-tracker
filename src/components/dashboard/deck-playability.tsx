"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/backlog/format";
import type { GameSummary } from "@/lib/backlog/types";
import {
  formatProtonDbScore,
  getDeckExperienceLabel,
  getProtonDbTierLabel,
  getSteamDeckCompatibilityCategoryLabel,
  hasDeckPlayabilityData,
} from "@/lib/steam/deck-playability";
import { cn } from "@/lib/utils";

type DeckPlayabilityGame = Pick<
  GameSummary,
  | "steamDeckCompatibilityCategory"
  | "steamDeckCompatibilityItems"
  | "protondbTier"
  | "protondbConfidence"
  | "protondbScore"
  | "protondbReportCount"
  | "deckPlayabilityUpdatedAt"
>;

type DeckDetailsContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const DeckDetailsContext = createContext<DeckDetailsContextValue | null>(null);

export function DashboardDeckPlayabilityDetailsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return <DeckDetailsContext.Provider value={{ open, setOpen }}>{children}</DeckDetailsContext.Provider>;
}

export function DeckPlayabilityBadge({ game }: { game: DeckPlayabilityGame }) {
  if (!hasDeckPlayabilityData(game)) return null;

  const category = game.steamDeckCompatibilityCategory;
  const officialCategory = category && category !== "unknown" ? category : null;
  const label = officialCategory
    ? `Deck ${getSteamDeckCompatibilityCategoryLabel(officialCategory)}`
    : `Deck ${getProtonDbTierLabel(game.protondbTier)}`;

  return (
    <Badge
      variant={
        officialCategory === "unsupported" ? "destructive" : officialCategory === "verified" ? "default" : "secondary"
      }
      data-dashboard-deck-badge="playability"
      className="max-w-full"
    >
      <span className="truncate">{label}</span>
    </Badge>
  );
}

export function DashboardDeckPlayabilityDetails({
  game,
  className,
  metricsClassName,
}: {
  game: DeckPlayabilityGame;
  className?: string;
  metricsClassName?: string;
}) {
  const detailsId = useId();
  const context = useContext(DeckDetailsContext);
  const [localOpen, setLocalOpen] = useState(false);
  const open = context?.open ?? localOpen;
  const setOpen = context?.setOpen ?? setLocalOpen;
  if (!hasDeckPlayabilityData(game)) return null;

  const criteria = game.steamDeckCompatibilityItems ?? [];

  return (
    <div data-dashboard-deck-details="playability" className={cn("grid gap-2", className)}>
      <button
        type="button"
        aria-controls={detailsId}
        aria-expanded={open}
        aria-label={open ? "Hide Steam Deck details" : "Show Steam Deck details"}
        onClick={() => setOpen(!open)}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "w-full cursor-pointer justify-between px-0 text-muted-foreground hover:text-foreground",
        )}
      >
        <span>Deck experience</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-180" : null)}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={detailsId}
          data-dashboard-deck-metrics="playability"
          className={cn("grid gap-2 rounded-md bg-muted/60 p-2 text-xs", metricsClassName)}
        >
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Experience" value={getDeckExperienceLabel(game)} />
            <Metric
              label="Steam"
              value={getSteamDeckCompatibilityCategoryLabel(game.steamDeckCompatibilityCategory)}
            />
            <Metric label="ProtonDB" value={getProtonDbTierLabel(game.protondbTier)} />
            <Metric label="Confidence" value={game.protondbConfidence ? titleCase(game.protondbConfidence) : "-"} />
            <Metric label="Reports" value={game.protondbReportCount?.toString() ?? "-"} />
            <Metric label="Score" value={formatProtonDbScore(game.protondbScore)} />
            <Metric label="Updated" value={formatDate(game.deckPlayabilityUpdatedAt)} />
          </div>
          {criteria.length ? (
            <div className="grid gap-1 border-t border-border/60 pt-2">
              {criteria.map((item, index) => (
                <div key={`${item.locToken ?? item.label}-${index}`} className="flex min-w-0 items-start gap-1.5">
                  <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", criterionClassName(item.status))} />
                  <span className="min-w-0 text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          ) : null}
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

function criterionClassName(status: string) {
  if (status === "pass") return "bg-primary";
  if (status === "warning") return "bg-amber-500";
  if (status === "unsupported") return "bg-destructive";
  return "bg-muted-foreground";
}

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

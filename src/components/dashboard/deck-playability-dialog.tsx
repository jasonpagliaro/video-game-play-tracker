"use client";

import { Info } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function DeckPlayabilityDialog({
  title,
  summaryParts,
  className,
}: {
  title: string;
  summaryParts: string[];
  className?: string;
}) {
  const summary = summaryParts.join(" · ");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          data-dashboard-deck-summary="playability"
          className={cn(
            "grid min-w-0 gap-1 rounded-md border border-border/60 bg-muted/10 px-2 py-2 text-left text-xs transition-colors hover:border-border hover:bg-muted/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            className,
          )}
          aria-label={`Open Steam Deck compatibility details for ${title}`}
        >
          <span className="flex min-w-0 items-center justify-between gap-2">
            <span className="truncate text-[10px] font-medium text-muted-foreground">Steam Deck compatibility</span>
            <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </span>
          <span className="line-clamp-2 text-muted-foreground">{summary}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Steam Deck compatibility</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 rounded-md border border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
          {summaryParts.map((part) => (
            <div key={part} className="leading-relaxed">
              {part}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

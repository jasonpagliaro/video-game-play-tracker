"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";

import { CompletionTypeBadge, SlotBadge, StatusBadge } from "@/components/badges/game-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchDashboardGames, type DashboardSearchItem } from "@/lib/backlog/dashboard-search";

const RESULT_LIMIT = 8;

export function DashboardGameSearch({ games }: { games: DashboardSearchItem[] }) {
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const results = useMemo(
    () => searchDashboardGames(games, query, { limit: RESULT_LIMIT }),
    [games, query],
  );

  return (
    <section data-dashboard-game-search="finder" className="grid gap-2 rounded-lg border border-border/70 bg-card/60 p-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Find game</h2>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {games.length} game{games.length === 1 ? "" : "s"} indexed
          </div>
        </div>
        <div className="relative w-full md:max-w-md">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search games or Steam App ID"
            aria-label="Search games"
            className="h-9 pr-9 pl-8"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              onClick={() => setQuery("")}
              aria-label="Clear game search"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {trimmedQuery ? (
        <div className="grid gap-2" aria-live="polite">
          <div className="text-xs text-muted-foreground">
            {results.length ? `${results.length} result${results.length === 1 ? "" : "s"}` : "No matching games"}
          </div>
          {results.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {results.map((game) => (
                <Link
                  key={game.id}
                  href={`/games/${game.id}`}
                  className="grid min-w-0 gap-2 rounded-lg border border-border/70 bg-background/70 p-2.5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">{game.title}</span>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {game.currentRotation ? <Badge>Active</Badge> : null}
                    {game.queuePosition != null ? (
                      <Badge variant="secondary" className="font-mono">
                        #{game.queuePosition}
                      </Badge>
                    ) : null}
                    {game.steamAppId != null ? (
                      <Badge variant="outline" className="font-mono">
                        App {game.steamAppId}
                      </Badge>
                    ) : null}
                    <StatusBadge status={game.status} />
                    <SlotBadge slot={game.backlogSlot} />
                    <CompletionTypeBadge completionType={game.completionType} />
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

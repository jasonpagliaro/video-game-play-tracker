import type { ReactNode } from "react";
import Link from "next/link";
import { CircleSlash, ListPlus, ParkingCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/backlog/format";
import { isParkedReassessmentDue } from "@/lib/backlog/rotation-fill";
import type { AppSettings, GameSummary } from "@/lib/backlog/types";
import {
  markGameWontCompleteFromSuggestionAction,
  parkGameForLaterAction,
  returnParkedGameToQueueAction,
} from "@/server/actions/game-actions";

export function ParkedReassessmentPanel({
  games,
  settings,
}: {
  games: GameSummary[];
  settings: AppSettings;
}) {
  const due = games
    .filter((game) => isParkedReassessmentDue(game))
    .sort((a, b) => (a.reassessAfter?.getTime() ?? 0) - (b.reassessAfter?.getTime() ?? 0));

  if (due.length === 0) return null;

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">Ready to reassess</CardTitle>
        <CardDescription>{due.length} Parked-for-later {due.length === 1 ? "game" : "games"}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {due.map((game) => (
          <div key={game.id} className="grid gap-3 rounded-md border border-border/70 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0">
              <Link href={`/games/${game.id}`} className="font-medium underline-offset-4 hover:underline">
                {game.title}
              </Link>
              <div className="mt-1 text-xs text-muted-foreground">
                Reassess {formatDate(game.reassessAfter)}; skip history reset when queued.
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <GameActionForm action={returnParkedGameToQueueAction} gameId={game.id}>
                <Button type="submit" size="sm" className="gap-1">
                  <ListPlus className="h-3.5 w-3.5" />
                  Return to queue
                </Button>
              </GameActionForm>
              <GameActionForm action={parkGameForLaterAction} gameId={game.id}>
                <Button type="submit" size="sm" variant="outline" className="gap-1">
                  <ParkingCircle className="h-3.5 w-3.5" />
                  Park {settings.parkedReassessmentDays}d
                </Button>
              </GameActionForm>
              <GameActionForm action={markGameWontCompleteFromSuggestionAction} gameId={game.id}>
                <Button type="submit" size="sm" variant="ghost" className="gap-1">
                  <CircleSlash className="h-3.5 w-3.5" />
                  Won&apos;t
                </Button>
              </GameActionForm>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function GameActionForm({
  action,
  gameId,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  gameId: string;
  children: ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="gameId" value={gameId} />
      {children}
    </form>
  );
}

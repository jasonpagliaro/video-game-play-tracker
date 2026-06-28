import type { ReactNode } from "react";
import Link from "next/link";
import { CircleSlash, ParkingCircle, Plus, RotateCw, SkipForward, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { formatDate, formatMinutes } from "@/lib/backlog/format";
import {
  getOpenRotationSlots,
  getRotationFillCandidates,
  isRotationSkipActive,
  requiresRotationDecision,
} from "@/lib/backlog/rotation-fill";
import type { AppSettings, GameSummary } from "@/lib/backlog/types";
import {
  addRotationSuggestionToRotationAction,
  fillRotationFromQueueAction,
  markGameWontCompleteFromSuggestionAction,
  parkGameForLaterAction,
  skipRotationSuggestionAction,
} from "@/server/actions/game-actions";

export function RotationFillPanel({
  games,
  settings,
  title = "Fill rotation",
}: {
  games: GameSummary[];
  settings: AppSettings;
  title?: string;
}) {
  const now = new Date();
  const openSlots = getOpenRotationSlots(games, settings);
  if (openSlots <= 0) return null;

  const candidates = getRotationFillCandidates(games, settings, {
    now,
    limit: Math.max(1, openSlots),
  });
  const skippedCount = games.filter((game) => game.queueRank != null && isRotationSkipActive(game, now)).length;

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {openSlots} open {openSlots === 1 ? "slot" : "slots"}
          {skippedCount ? `; ${skippedCount} temporarily skipped` : ""}
        </CardDescription>
        <CardAction>
          <form action={fillRotationFromQueueAction}>
            <PendingSubmitButton size="sm" disabled={candidates.length === 0} pendingLabel="Filling...">
              <RotateCw className="h-4 w-4" />
              Fill open slots
            </PendingSubmitButton>
          </form>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {candidates.length ? (
          candidates.map((game, index) => (
            <RotationSuggestionRow
              key={game.id}
              game={game}
              position={index + 1}
              settings={settings}
            />
          ))
        ) : (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No queued games are available for rotation right now.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RotationSuggestionRow({
  game,
  position,
  settings,
}: {
  game: GameSummary;
  position: number;
  settings: AppSettings;
}) {
  const decisionRequired = requiresRotationDecision(game, settings);

  return (
    <div className="grid gap-3 rounded-md border border-border/70 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            #{position}
          </Badge>
          {decisionRequired ? (
            <Badge variant="destructive" className="gap-1">
              <TriangleAlert className="h-3.5 w-3.5" />
              Decision due
            </Badge>
          ) : null}
          <Link href={`/games/${game.id}`} className="min-w-0 font-medium underline-offset-4 hover:underline">
            <span className="line-clamp-1">{game.title}</span>
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Skipped {game.rotationSkipCount}/{settings.rotationSkipLimit}</span>
          <span>Playtime {formatMinutes(game.playtimeMinutes)}</span>
          <span>Last {formatDate(game.lastPlayed)}</span>
          <span>Priority score {game.priorityScore}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <GameActionForm action={addRotationSuggestionToRotationAction} gameId={game.id}>
          <PendingSubmitButton size="sm" className="gap-1" pendingLabel="Adding...">
            <Plus className="h-3.5 w-3.5" />
            Add
          </PendingSubmitButton>
        </GameActionForm>
        {!decisionRequired ? (
          <GameActionForm action={skipRotationSuggestionAction} gameId={game.id}>
            <PendingSubmitButton size="sm" variant="outline" className="gap-1" pendingLabel="Skipping...">
              <SkipForward className="h-3.5 w-3.5" />
              Skip {settings.rotationSkipCooldownDays}d
            </PendingSubmitButton>
          </GameActionForm>
        ) : null}
        <GameActionForm action={parkGameForLaterAction} gameId={game.id}>
          <PendingSubmitButton size="sm" variant="outline" className="gap-1" pendingLabel="Parking...">
            <ParkingCircle className="h-3.5 w-3.5" />
            Park
          </PendingSubmitButton>
        </GameActionForm>
        <GameActionForm action={markGameWontCompleteFromSuggestionAction} gameId={game.id}>
          <PendingSubmitButton size="sm" variant="ghost" className="gap-1" pendingLabel="Marking...">
            <CircleSlash className="h-3.5 w-3.5" />
            Won&apos;t
          </PendingSubmitButton>
        </GameActionForm>
      </div>
    </div>
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

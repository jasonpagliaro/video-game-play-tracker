"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUp, ListPlus, Minus, Plus } from "lucide-react";

import { AutoSaveStatus } from "@/components/autosave/auto-save-status";
import { useAutoSaveField } from "@/components/autosave/use-auto-save-field";
import { StatusResolutionDialog, type StatusResolutionIntent } from "@/components/backlog/status-resolution-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BACKLOG_SLOTS,
  COMPLETION_TYPES,
  GAME_STATUSES,
  INTEREST_LABELS,
  PERSONAL_INTERESTS,
  SLOT_LABELS,
  STATUS_LABELS,
  COMPLETION_TYPE_LABELS,
  type BacklogSlot,
  type CompletionType,
  type GameStatus,
  type PersonalInterest,
} from "@/lib/backlog/constants";
import { isGameStatus, type GameVisibilitySnapshot } from "@/lib/backlog/autosave";
import { formatDate } from "@/lib/backlog/format";
import type { AppSettings, Game, GameSummary } from "@/lib/backlog/types";
import {
  autoSaveGameFieldAction,
  queueCommandFeedbackAction,
  returnParkedGameToQueueFeedbackAction,
} from "@/server/actions/game-actions";

type QueueFeedbackAction = (formData: FormData) => void | Promise<void>;

export function GameDetailEditor({
  game,
  settings,
  activeGames,
}: {
  game: Game;
  settings: AppSettings;
  activeGames: GameSummary[];
}) {
  const router = useRouter();
  const [resolutionIntent, setResolutionIntent] = useState<StatusResolutionIntent>(null);
  const activeFull = activeGames.length >= settings.maxActiveRotationCount;
  const onSaved = () => router.refresh();

  const status = useAutoSaveField<GameStatus, GameVisibilitySnapshot>({
    initialValue: game.status,
    save: (value) => autoSaveGameFieldAction({ gameId: game.id, field: "status", value }),
    onSaved,
  });
  const backlogSlot = useAutoSaveField<BacklogSlot, GameVisibilitySnapshot>({
    initialValue: game.backlogSlot,
    save: (value) => autoSaveGameFieldAction({ gameId: game.id, field: "backlogSlot", value }),
  });
  const completionType = useAutoSaveField<CompletionType, GameVisibilitySnapshot>({
    initialValue: game.completionType,
    save: (value) => autoSaveGameFieldAction({ gameId: game.id, field: "completionType", value }),
  });
  const personalInterest = useAutoSaveField<PersonalInterest, GameVisibilitySnapshot>({
    initialValue: game.personalInterest,
    save: (value) => autoSaveGameFieldAction({ gameId: game.id, field: "personalInterest", value }),
  });
  const dnfReason = useAutoSaveField<string, GameVisibilitySnapshot>({
    initialValue: game.dnfReason ?? "",
    save: (value) => autoSaveGameFieldAction({ gameId: game.id, field: "dnfReason", value }),
    validate: (value) => (status.value === "dnf" && !value.trim() ? "DNF requires a reason." : null),
    onSaved,
  });
  const notes = useAutoSaveField<string, GameVisibilitySnapshot>({
    initialValue: game.notes ?? "",
    save: (value) => autoSaveGameFieldAction({ gameId: game.id, field: "notes", value }),
    onSaved,
  });

  function handleStatusChange(value: string) {
    if (!isGameStatus(value)) return;
    if (value === "dnf") {
      setResolutionIntent({ kind: "status", game, status: value });
      return;
    }
    if (
      value === "in_progress" &&
      !game.currentRotation &&
      settings.inProgressAddsToRotationWhenSpace &&
      activeFull
    ) {
      setResolutionIntent({ kind: "status", game, status: value });
      return;
    }
    status.setAndSave(value);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions and classification</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <AutoSaveSelectField
              id="game-status"
              label="Status"
              value={status.value}
              status={status.status}
              message={status.message}
              onValueChange={handleStatusChange}
              options={GAME_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
            />
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="dnf-reason">DNF reason</Label>
                <AutoSaveStatus status={dnfReason.status} message={dnfReason.message} />
              </div>
              <Input
                id="dnf-reason"
                value={dnfReason.value}
                onChange={(event) => dnfReason.setAndScheduleSave(event.target.value)}
                onBlur={dnfReason.flush}
                placeholder="Only needed when marking DNF"
              />
            </div>
            <AutoSaveSelectField
              id="backlog-slot"
              label="Backlog category"
              value={backlogSlot.value}
              status={backlogSlot.status}
              message={backlogSlot.message}
              onValueChange={(value) => backlogSlot.setAndSave(value as BacklogSlot)}
              options={BACKLOG_SLOTS.map((value) => ({ value, label: SLOT_LABELS[value] }))}
            />
            <AutoSaveSelectField
              id="completion-type"
              label="Finish style"
              value={completionType.value}
              status={completionType.status}
              message={completionType.message}
              onValueChange={(value) => completionType.setAndSave(value as CompletionType)}
              options={COMPLETION_TYPES.map((value) => ({ value, label: COMPLETION_TYPE_LABELS[value] }))}
            />
            <AutoSaveSelectField
              id="personal-interest"
              label="Personal interest"
              value={personalInterest.value}
              status={personalInterest.status}
              message={personalInterest.message}
              onValueChange={(value) => personalInterest.setAndSave(value as PersonalInterest)}
              options={PERSONAL_INTERESTS.map((value) => ({ value, label: INTEREST_LABELS[value] }))}
            />
            <QueueMembershipControl game={game} />
            <div className="grid gap-2 md:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="game-notes">Notes</Label>
                <AutoSaveStatus status={notes.status} message={notes.message} />
              </div>
              <Textarea
                id="game-notes"
                value={notes.value}
                onChange={(event) => notes.setAndScheduleSave(event.target.value)}
                onBlur={notes.flush}
                placeholder="Planning notes, caveats, or context"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <StatusResolutionDialog
        intent={resolutionIntent}
        activeGames={activeGames}
        onOpenChange={(open) => {
          if (!open) setResolutionIntent(null);
        }}
        onSaved={() => router.refresh()}
      />
    </>
  );
}

function AutoSaveSelectField({
  id,
  label,
  value,
  status,
  message,
  options,
  onValueChange,
}: {
  id: string;
  label: string;
  value: string;
  status: "idle" | "saving" | "saved" | "error";
  message: string | null;
  options: { value: string; label: string }[];
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <AutoSaveStatus status={status} message={message} />
      </div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function QueueMembershipControl({ game }: { game: Game }) {
  const queued = game.queueRank != null;
  const eligible = canAddToQueue(game);

  if (game.parkedForLater) {
    return (
      <div className="grid gap-2">
        <Label>Queue</Label>
        <div className="flex min-h-9 flex-wrap items-center gap-2" aria-live="polite">
          <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
            Parked until {formatDate(game.reassessAfter)}
          </span>
          <form action={returnParkedGameToQueueFeedbackAction}>
            <input type="hidden" name="gameId" value={game.id} />
            <PendingSubmitButton
              size="sm"
              variant="outline"
              className="h-8 gap-1"
              pendingLabel="Returning..."
            >
              <ListPlus className="h-3.5 w-3.5" />
              Return to queue
            </PendingSubmitButton>
          </form>
          <ForceNextQueueButton action={queueCommandFeedbackAction} game={game} />
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <Label>Queue</Label>
      <div className="flex min-h-9 flex-wrap items-center gap-2" aria-live="polite">
        {queued ? (
          <>
            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">Queued</span>
            <form action={queueCommandFeedbackAction}>
              <input type="hidden" name="gameId" value={game.id} />
              <input type="hidden" name="command" value="remove_from_queue" />
              <PendingSubmitButton
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                pendingLabel="Removing..."
              >
                <Minus className="h-3.5 w-3.5" />
                Remove
              </PendingSubmitButton>
            </form>
            <ForceNextQueueButton action={queueCommandFeedbackAction} game={game} />
          </>
        ) : (
          <>
            <form action={queueCommandFeedbackAction}>
              <input type="hidden" name="gameId" value={game.id} />
              <input type="hidden" name="command" value="add_to_queue" />
              <PendingSubmitButton
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                disabled={!eligible}
                pendingLabel="Queuing..."
              >
                <Plus className="h-3.5 w-3.5" />
                Add to queue
              </PendingSubmitButton>
            </form>
            <ForceNextQueueButton action={queueCommandFeedbackAction} game={game} />
          </>
        )}
      </div>
    </div>
  );
}

function ForceNextQueueButton({
  action,
  game,
  disabled = false,
}: {
  action: QueueFeedbackAction;
  game: Game;
  disabled?: boolean;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="gameId" value={game.id} />
      <input type="hidden" name="command" value="force_next_in_queue" />
      <PendingSubmitButton
        size="sm"
        variant="secondary"
        className="h-8 gap-1"
        title="Force up next"
        disabled={disabled || !canForceNextInQueue(game)}
        pendingLabel="Moving..."
      >
        <ChevronsUp className="h-3.5 w-3.5" />
        Up next
      </PendingSubmitButton>
    </form>
  );
}

function canAddToQueue(game: Game) {
  return (
    game.queueRank == null &&
    !game.currentRotation &&
    !game.parkedForLater &&
    game.syncState !== "ignored" &&
    game.status !== "completed" &&
    game.status !== "done_for_now" &&
    game.status !== "dnf" &&
    game.status !== "parked" &&
    game.status !== "wont_complete"
  );
}

function canForceNextInQueue(game: Game) {
  return !game.currentRotation;
}

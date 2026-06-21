"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GameStatus } from "@/lib/backlog/constants";
import type { GameVisibilitySnapshot } from "@/lib/backlog/autosave";
import type { GameSummary } from "@/lib/backlog/types";
import { autoSaveGameFieldAction } from "@/server/actions/game-actions";

type ResolutionGame = Pick<GameSummary, "id" | "title" | "dnfReason">;
type ActiveGame = Pick<GameSummary, "id" | "title">;

export type StatusResolutionIntent =
  | { kind: "rotation"; game: ResolutionGame; sourceIndex?: number }
  | { kind: "status"; game: ResolutionGame; status: GameStatus; sourceIndex?: number }
  | null;

export function StatusResolutionDialog({
  intent,
  activeGames,
  onOpenChange,
  onSaved,
}: {
  intent: StatusResolutionIntent;
  activeGames: ActiveGame[];
  onOpenChange: (open: boolean) => void;
  onSaved: (intent: Exclude<StatusResolutionIntent, null>, snapshot: GameVisibilitySnapshot) => void;
}) {
  const open = Boolean(intent);
  const dialogKey = intent
    ? `${intent.kind}-${intent.game.id}-${intent.kind === "status" ? intent.status : "rotation"}`
    : "closed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {intent ? (
          <StatusResolutionForm
            key={dialogKey}
            intent={intent}
            activeGames={activeGames}
            onOpenChange={onOpenChange}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function StatusResolutionForm({
  intent,
  activeGames,
  onOpenChange,
  onSaved,
}: {
  intent: Exclude<StatusResolutionIntent, null>;
  activeGames: ActiveGame[];
  onOpenChange: (open: boolean) => void;
  onSaved: (intent: Exclude<StatusResolutionIntent, null>, snapshot: GameVisibilitySnapshot) => void;
}) {
  const needsDnfReason = intent.kind === "status" && intent.status === "dnf";
  const needsReplacement = intent.kind === "rotation" || (intent.kind === "status" && intent.status === "in_progress");
  const replacementOptions = activeGames.filter((game) => game.id !== intent.game.id);
  const [replacementId, setReplacementId] = useState("");
  const [dnfReason, setDnfReason] = useState(intent.game.dnfReason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedReplacementId = replacementId || replacementOptions[0]?.id || "";

  async function applyResolution() {
    if (needsDnfReason && !dnfReason.trim()) {
      setError("DNF requires a reason.");
      return;
    }
    if (needsReplacement && !selectedReplacementId) {
      setError("Choose a game to remove from rotation first.");
      return;
    }

    setSaving(true);
    setError(null);
    const result =
      intent.kind === "rotation"
        ? await autoSaveGameFieldAction({
            gameId: intent.game.id,
            field: "currentRotation",
            value: true,
            replacementGameId: selectedReplacementId,
          })
        : await autoSaveGameFieldAction({
            gameId: intent.game.id,
            field: "status",
            value: intent.status,
            dnfReason,
            replacementGameId: selectedReplacementId,
          });
    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      toast.error(result.message);
      return;
    }

    onSaved(intent, result.value);
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{needsDnfReason ? "Add DNF reason" : "Choose a rotation replacement"}</DialogTitle>
        <DialogDescription>
          {needsDnfReason
            ? "DNF requires a reason before the status can be saved."
            : "The active limit is full. Pick the active game that leaves rotation."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        {needsDnfReason ? (
          <Input value={dnfReason} onChange={(event) => setDnfReason(event.target.value)} placeholder="DNF reason" />
        ) : null}
        {needsReplacement ? (
          <Select value={selectedReplacementId} onValueChange={setReplacementId}>
            <SelectTrigger>
              <SelectValue placeholder="Active game to remove" />
            </SelectTrigger>
            <SelectContent>
              {replacementOptions.map((game) => (
                <SelectItem key={game.id} value={game.id}>
                  {game.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={applyResolution} disabled={saving}>
            {saving ? "Saving" : "Apply"}
          </Button>
        </div>
      </div>
    </>
  );
}

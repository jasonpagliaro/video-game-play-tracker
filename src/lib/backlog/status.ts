import type { GameStatus } from "./constants";
import type { AppSettings, Game } from "./types";

export type StatusTransitionInput = {
  game: Pick<
    Game,
    | "status"
    | "installed"
    | "currentRotation"
    | "dateStarted"
    | "dateCompleted"
    | "dateDnf"
    | "queueRank"
    | "dnfReason"
  >;
  newStatus: GameStatus;
  settings: AppSettings;
  activeCount: number;
  dnfReason?: string | null;
  now?: Date;
};

export type TransitionPatch = {
  status: GameStatus;
  installed?: boolean;
  currentRotation?: boolean;
  queueRank?: number | null;
  dateStarted?: Date;
  dateCompleted?: Date;
  dateDnf?: Date;
  dnfReason?: string | null;
  needsReplacement?: boolean;
};

export function transitionGameStatus(input: StatusTransitionInput): TransitionPatch {
  const now = input.now ?? new Date();
  const patch: TransitionPatch = { status: input.newStatus };

  if (input.newStatus === "completed") {
    patch.dateCompleted = input.game.dateCompleted ?? now;
    patch.currentRotation = false;
    patch.queueRank = null;
    if (input.settings.completedSetsInstalledFalse) patch.installed = false;
    return patch;
  }

  if (input.newStatus === "dnf") {
    if (!input.dnfReason?.trim() && !input.game.dnfReason?.trim()) {
      throw new Error("DNF requires a reason.");
    }
    patch.dateDnf = input.game.dateDnf ?? now;
    patch.dnfReason = input.dnfReason?.trim() || input.game.dnfReason;
    patch.currentRotation = false;
    patch.queueRank = null;
    if (input.settings.dnfSetsInstalledFalse) patch.installed = false;
    return patch;
  }

  if (input.newStatus === "parked") {
    patch.currentRotation = false;
    patch.queueRank = null;
    if (input.settings.parkedSetsInstalledFalse) patch.installed = false;
    return patch;
  }

  if (input.newStatus === "wont_complete") {
    patch.currentRotation = false;
    patch.queueRank = null;
    patch.installed = false;
    return patch;
  }

  if (input.newStatus === "in_progress") {
    patch.dateStarted = input.game.dateStarted ?? now;
    if (input.settings.inProgressSetsInstalledTrue) patch.installed = true;
    if (!input.game.currentRotation && input.settings.inProgressAddsToRotationWhenSpace) {
      if (input.activeCount < input.settings.maxActiveRotationCount) {
        patch.currentRotation = true;
      } else {
        patch.needsReplacement = true;
      }
    }
    return patch;
  }

  if (input.newStatus === "installed") {
    patch.installed = true;
    return patch;
  }

  if (input.newStatus === "not_started") {
    patch.currentRotation = false;
    return patch;
  }

  return patch;
}


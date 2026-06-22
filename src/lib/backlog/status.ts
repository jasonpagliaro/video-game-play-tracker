import {
  OPEN_ENDED_COMPLETION_TYPES,
  type CompletionType,
  type GameStatus,
} from "./constants";
import type { AppSettings, Game } from "./types";

export const DONE_FOR_NOW_CANDIDATE_MINUTES = 120;

export function isDoneForNowCandidate(
  game: Pick<
    Game,
    "completionType" | "currentRotation" | "playtimeMinutes" | "queueRank" | "status" | "syncState"
  >,
) {
  return (
    isOpenEndedCompletionType(game.completionType) &&
    game.playtimeMinutes >= DONE_FOR_NOW_CANDIDATE_MINUTES &&
    !game.currentRotation &&
    game.queueRank == null &&
    game.syncState !== "ignored" &&
    game.status !== "completed" &&
    game.status !== "done_for_now" &&
    game.status !== "dnf" &&
    game.status !== "wont_complete"
  );
}

export function isOpenEndedCompletionType(completionType: CompletionType) {
  return OPEN_ENDED_COMPLETION_TYPES.includes(completionType);
}

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
  queueLocked?: boolean;
  dateStarted?: Date;
  dateCompleted?: Date;
  dateDnf?: Date;
  dnfReason?: string | null;
  rotationSkipCount?: number;
  rotationSkipUntil?: Date | null;
  rotationLastSkippedAt?: Date | null;
  parkedForLater?: boolean;
  reassessAfter?: Date | null;
  needsReplacement?: boolean;
};

export function transitionGameStatus(input: StatusTransitionInput): TransitionPatch {
  const now = input.now ?? new Date();
  const patch: TransitionPatch = {
    status: input.newStatus,
    parkedForLater: false,
    reassessAfter: null,
  };

  if (input.newStatus === "completed" || input.newStatus === "done_for_now") {
    patch.dateCompleted = input.game.dateCompleted ?? now;
    patch.currentRotation = false;
    patch.queueRank = null;
    patch.queueLocked = false;
    clearRotationPlanning(patch);
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
    patch.queueLocked = false;
    clearRotationPlanning(patch);
    if (input.settings.dnfSetsInstalledFalse) patch.installed = false;
    return patch;
  }

  if (input.newStatus === "parked") {
    patch.currentRotation = false;
    patch.queueRank = null;
    patch.queueLocked = false;
    clearRotationPlanning(patch);
    if (input.settings.parkedSetsInstalledFalse) patch.installed = false;
    return patch;
  }

  if (input.newStatus === "wont_complete") {
    patch.currentRotation = false;
    patch.queueRank = null;
    patch.queueLocked = false;
    patch.installed = false;
    clearRotationPlanning(patch);
    return patch;
  }

  if (input.newStatus === "in_progress") {
    patch.dateStarted = input.game.dateStarted ?? now;
    clearRotationPlanning(patch);
    if (input.settings.inProgressSetsInstalledTrue) patch.installed = true;
    if (!input.game.currentRotation && input.settings.inProgressAddsToRotationWhenSpace) {
      if (input.activeCount < input.settings.maxActiveRotationCount) {
        patch.currentRotation = true;
        patch.queueRank = null;
        patch.queueLocked = false;
      } else {
        patch.needsReplacement = true;
      }
    }
    return patch;
  }

  if (input.newStatus === "installed") {
    patch.installed = true;
    clearRotationPlanning(patch);
    return patch;
  }

  if (input.newStatus === "not_started") {
    patch.currentRotation = false;
    clearRotationPlanning(patch);
    return patch;
  }

  return patch;
}

function clearRotationPlanning(patch: TransitionPatch) {
  patch.rotationSkipCount = 0;
  patch.rotationSkipUntil = null;
  patch.rotationLastSkippedAt = null;
  patch.parkedForLater = false;
  patch.reassessAfter = null;
}

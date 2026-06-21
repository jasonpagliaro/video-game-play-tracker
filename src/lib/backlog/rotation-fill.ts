import type { GameStatus } from "./constants";
import { isQueueEligible } from "./queue";
import type { AppSettings, GameSummary } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type RotationFillGame = Pick<
  GameSummary,
  | "id"
  | "title"
  | "status"
  | "installed"
  | "currentRotation"
  | "backlogSlot"
  | "completionType"
  | "priorityScore"
  | "queueRank"
  | "queueLocked"
  | "personalInterest"
  | "estimatedHours"
  | "syncState"
  | "rotationSkipCount"
  | "rotationSkipUntil"
  | "parkedForLater"
  | "reassessAfter"
>;

export type RotationFillSettings = Pick<
  AppSettings,
  "maxActiveRotationCount" | "rotationSkipCooldownDays" | "rotationSkipLimit" | "parkedReassessmentDays"
>;

export type RotationGamePatch = {
  status?: GameStatus;
  installed?: boolean;
  currentRotation?: boolean;
  queueRank?: number | null;
  queueLocked?: boolean;
  rotationSkipCount?: number;
  rotationSkipUntil?: Date | null;
  rotationLastSkippedAt?: Date | null;
  parkedForLater?: boolean;
  reassessAfter?: Date | null;
};

export function getOpenRotationSlots(
  games: Pick<RotationFillGame, "currentRotation">[],
  settings: Pick<RotationFillSettings, "maxActiveRotationCount">,
) {
  const activeCount = games.filter((game) => game.currentRotation).length;
  return Math.max(0, settings.maxActiveRotationCount - activeCount);
}

export function getRotationFillCandidates<T extends RotationFillGame>(
  games: T[],
  settings: RotationFillSettings,
  options: { now?: Date; limit?: number } = {},
) {
  const now = options.now ?? new Date();
  const openSlots = getOpenRotationSlots(games, settings);
  const limit = options.limit ?? openSlots;
  if (openSlots <= 0 || limit <= 0) return [];
  return games
    .filter((game) => isRotationFillCandidate(game, now))
    .sort(compareByQueueRank)
    .slice(0, limit);
}

export function isRotationFillCandidate(game: RotationFillGame, now: Date = new Date()) {
  return (
    game.queueRank != null &&
    !game.parkedForLater &&
    isQueueEligible(game) &&
    !isRotationSkipActive(game, now)
  );
}

export function isRotationSkipActive(
  game: Pick<RotationFillGame, "rotationSkipUntil">,
  now: Date = new Date(),
) {
  const skipUntil = dateTime(game.rotationSkipUntil);
  return skipUntil != null && skipUntil > now.getTime();
}

export function requiresRotationDecision(
  game: Pick<RotationFillGame, "rotationSkipCount">,
  settings: Pick<RotationFillSettings, "rotationSkipLimit">,
) {
  return game.rotationSkipCount >= settings.rotationSkipLimit;
}

export function canTemporarilySkipRotationSuggestion(
  game: Pick<RotationFillGame, "rotationSkipCount" | "rotationSkipUntil">,
  settings: Pick<RotationFillSettings, "rotationSkipLimit">,
  now: Date = new Date(),
) {
  return !isRotationSkipActive(game, now) && !requiresRotationDecision(game, settings);
}

export function buildRotationSkipPatch(
  game: Pick<RotationFillGame, "rotationSkipCount" | "rotationSkipUntil">,
  settings: Pick<RotationFillSettings, "rotationSkipCooldownDays" | "rotationSkipLimit">,
  now: Date = new Date(),
): RotationGamePatch {
  if (!canTemporarilySkipRotationSuggestion(game, settings, now)) {
    throw new Error("This game needs a keep, park, or won't-complete decision.");
  }
  return {
    rotationSkipCount: game.rotationSkipCount + 1,
    rotationSkipUntil: addDays(now, settings.rotationSkipCooldownDays),
    rotationLastSkippedAt: now,
  };
}

export function buildAddToRotationPatch(): RotationGamePatch {
  return {
    currentRotation: true,
    installed: true,
    queueRank: null,
    queueLocked: false,
    rotationSkipCount: 0,
    rotationSkipUntil: null,
    rotationLastSkippedAt: null,
    parkedForLater: false,
    reassessAfter: null,
  };
}

export function buildParkForLaterPatch(
  settings: Pick<RotationFillSettings, "parkedReassessmentDays">,
  now: Date = new Date(),
): RotationGamePatch {
  return {
    status: "parked",
    installed: false,
    currentRotation: false,
    queueRank: null,
    queueLocked: false,
    rotationSkipCount: 0,
    rotationSkipUntil: null,
    rotationLastSkippedAt: null,
    parkedForLater: true,
    reassessAfter: addDays(now, settings.parkedReassessmentDays),
  };
}

export function buildReturnFromParkedPatch(): RotationGamePatch {
  return {
    status: "not_started",
    currentRotation: false,
    queueLocked: false,
    rotationSkipCount: 0,
    rotationSkipUntil: null,
    rotationLastSkippedAt: null,
    parkedForLater: false,
    reassessAfter: null,
  };
}

export function buildWontCompletePatch(): RotationGamePatch {
  return {
    status: "wont_complete",
    installed: false,
    currentRotation: false,
    queueRank: null,
    queueLocked: false,
    rotationSkipCount: 0,
    rotationSkipUntil: null,
    rotationLastSkippedAt: null,
    parkedForLater: false,
    reassessAfter: null,
  };
}

export function isParkedReassessmentDue(
  game: Pick<RotationFillGame, "status" | "parkedForLater" | "reassessAfter">,
  now: Date = new Date(),
) {
  const reassessAfter = dateTime(game.reassessAfter);
  return game.status === "parked" && game.parkedForLater && reassessAfter != null && reassessAfter <= now.getTime();
}

function compareByQueueRank(a: Pick<RotationFillGame, "queueRank" | "title">, b: Pick<RotationFillGame, "queueRank" | "title">) {
  const rank = (a.queueRank ?? Number.MAX_SAFE_INTEGER) - (b.queueRank ?? Number.MAX_SAFE_INTEGER);
  if (rank !== 0) return rank;
  return a.title.localeCompare(b.title);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS);
}

function dateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

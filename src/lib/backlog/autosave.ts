import {
  BACKLOG_SLOTS,
  COMPLETION_TYPES,
  GAME_STATUSES,
  OPEN_ENDED_COMPLETION_TYPES,
  PERSONAL_INTERESTS,
  type BacklogSlot,
  type CompletionType,
  type GameStatus,
  type PersonalInterest,
  type SyncState,
} from "./constants";
import { isDoneForNowCandidate } from "./status";

export type GameTableView = "all" | "queue" | "rotation" | "completed" | "dnf" | "parking" | "ongoing";

export type GameVisibilityScope =
  | "all"
  | "queue"
  | "rotation_active"
  | "rotation_all"
  | "completed"
  | "dnf"
  | "parking_all"
  | "parking_done_for_now_candidate"
  | "parking_remaining"
  | "ongoing_done_for_now_candidate"
  | "ongoing_open_ended"
  | "ongoing_parked";

export type GameVisibilitySnapshot = {
  id: string;
  title: string;
  status: GameStatus;
  currentRotation: boolean;
  queueRank: number | null;
  backlogSlot: BacklogSlot;
  completionType: CompletionType;
  syncState: SyncState;
  playtimeMinutes: number;
  detailHref: string;
};

export type GameTableFilters = {
  statusFilter: string;
  slotFilter: string;
  typeFilter: string;
};

export type GameDestination = {
  href: string;
  label: string;
};

export type AutoSaveResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export type AutoSaveGameFieldInput =
  | { gameId: string; field: "status"; value: GameStatus; dnfReason?: string; replacementGameId?: string }
  | { gameId: string; field: "backlogSlot"; value: BacklogSlot }
  | { gameId: string; field: "completionType"; value: CompletionType }
  | { gameId: string; field: "personalInterest"; value: PersonalInterest }
  | { gameId: string; field: "notes"; value: string }
  | { gameId: string; field: "dnfReason"; value: string }
  | { gameId: string; field: "installed"; value: boolean }
  | { gameId: string; field: "currentRotation"; value: boolean; replacementGameId?: string };

export type AutoSaveSettingsFieldInput =
  | { field: "maxActiveRotationCount"; value: string }
  | { field: "maxInstalledCount"; value: string }
  | { field: "checkinIntervalDays"; value: string }
  | { field: "checkinIntervalHoursPlayed"; value: string }
  | { field: "queueSlidingWindowSize"; value: string }
  | { field: "completedSetsInstalledFalse"; value: boolean }
  | { field: "dnfSetsInstalledFalse"; value: boolean }
  | { field: "parkedSetsInstalledFalse"; value: boolean }
  | { field: "inProgressSetsInstalledTrue"; value: boolean }
  | { field: "inProgressAddsToRotationWhenSpace"; value: boolean }
  | { field: "autoQueueNewImports"; value: boolean }
  | { field: "protectManualFieldsFromSync"; value: boolean };

const TERMINAL_PARKING_EXCLUSIONS = new Set<GameStatus>([
  "completed",
  "done_for_now",
  "dnf",
  "wont_complete",
]);

export function isGameStatus(value: string): value is GameStatus {
  return GAME_STATUSES.includes(value as GameStatus);
}

export function isBacklogSlot(value: string): value is BacklogSlot {
  return BACKLOG_SLOTS.includes(value as BacklogSlot);
}

export function isCompletionType(value: string): value is CompletionType {
  return COMPLETION_TYPES.includes(value as CompletionType);
}

export function isPersonalInterest(value: string): value is PersonalInterest {
  return PERSONAL_INTERESTS.includes(value as PersonalInterest);
}

export function parsePositiveInteger(
  value: string,
  label: string,
  min: number,
): AutoSaveResult<number> {
  const trimmed = value.trim();
  const parsed = Number(trimmed);
  if (!trimmed || !Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return { ok: false, message: `${label} must be a whole number.` };
  }
  if (parsed < min) {
    return { ok: false, message: `${label} must be at least ${min}.` };
  }
  return { ok: true, value: parsed };
}

export function parseOptionalPositiveInteger(
  value: string,
  label: string,
  min: number,
): AutoSaveResult<number | null> {
  if (!value.trim()) return { ok: true, value: null };
  return parsePositiveInteger(value, label, min);
}

export function getDefaultVisibilityScope(
  view: GameTableView,
  games: Pick<GameVisibilitySnapshot, "currentRotation">[],
): GameVisibilityScope {
  if (view === "queue") return "queue";
  if (view === "completed") return "completed";
  if (view === "dnf") return "dnf";
  if (view === "parking" || view === "ongoing") return "parking_all";
  if (view === "rotation") {
    return games.some((game) => !game.currentRotation) ? "rotation_all" : "rotation_active";
  }
  return "all";
}

export function isInParkingRoute(
  game: Pick<GameVisibilitySnapshot, "completionType" | "status">,
) {
  return (
    (game.status === "parked" || isParkingCompletionType(game.completionType)) &&
    !TERMINAL_PARKING_EXCLUSIONS.has(game.status)
  );
}

export function isParkingCompletionType(completionType: CompletionType) {
  return OPEN_ENDED_COMPLETION_TYPES.includes(completionType);
}

export function gameMatchesVisibilityScope(
  game: GameVisibilitySnapshot,
  scope: GameVisibilityScope,
) {
  if (scope === "all") return true;
  if (scope === "queue") return game.queueRank != null;
  if (scope === "rotation_active") return game.currentRotation;
  if (scope === "rotation_all") return true;
  if (scope === "completed") return game.status === "completed" || game.status === "done_for_now";
  if (scope === "dnf") return game.status === "dnf" || game.status === "wont_complete";
  if (scope === "parking_all") return isInParkingRoute(game);
  if (scope === "parking_done_for_now_candidate") return isDoneForNowCandidate(game);
  if (scope === "parking_remaining") return isInParkingRoute(game) && !isDoneForNowCandidate(game);
  if (scope === "ongoing_done_for_now_candidate") return isDoneForNowCandidate(game);
  if (scope === "ongoing_open_ended") {
    return isInParkingRoute(game) && game.status !== "parked" && !isDoneForNowCandidate(game);
  }
  if (scope === "ongoing_parked") {
    return isInParkingRoute(game) && game.status === "parked" && !isDoneForNowCandidate(game);
  }
  return true;
}

export function gameMatchesFilters(game: GameVisibilitySnapshot, filters: GameTableFilters) {
  if (filters.statusFilter !== "all" && game.status !== filters.statusFilter) return false;
  if (filters.slotFilter !== "all" && game.backlogSlot !== filters.slotFilter) return false;
  if (filters.typeFilter !== "all" && game.completionType !== filters.typeFilter) return false;
  return true;
}

export function gameIsVisibleInTable(
  game: GameVisibilitySnapshot,
  scope: GameVisibilityScope,
  filters: GameTableFilters,
) {
  return gameMatchesVisibilityScope(game, scope) && gameMatchesFilters(game, filters);
}

export function getGameDestination(game: GameVisibilitySnapshot): GameDestination {
  if (game.currentRotation) return { href: "/rotation", label: "Rotation" };
  if (game.queueRank != null) return { href: "/queue", label: "Next Up" };
  if (game.status === "completed" || game.status === "done_for_now") {
    return { href: "/completed", label: "Completed" };
  }
  if (game.status === "dnf" || game.status === "wont_complete") {
    return { href: "/dnf", label: "DNF / Won't" };
  }
  if (isInParkingRoute(game)) return { href: "/ongoing", label: "Ongoing" };
  return { href: "/backlog", label: "Backlog" };
}

export function ghostReasonForGame(game: GameVisibilitySnapshot) {
  const destination = getGameDestination(game);
  if (destination.href === "/backlog") return "Updated and no longer matches this view.";
  return `Moved to ${destination.label}.`;
}

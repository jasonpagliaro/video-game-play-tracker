import { BACKLOG_SLOTS, COMPLETION_TYPES, INTEREST_LABELS, SLOT_LABELS } from "./constants";
import type { QueueCandidate, QueueExplanation } from "./types";

export const QUEUE_RULES = {
  rankStep: 1000,
  defaultWindowSize: 5,
  priorityWeight: 1,
  positionPressureWeight: 0.2,
  slotNeedWeight: 28,
  completionTypeNeedWeight: 14,
  repeatSlotPenalty: 18,
  repeatTypePenalty: 9,
  tagOverlapPenalty: 8,
  highInterestBoost: 16,
  mediumInterestBoost: 7,
  startedGameBoost: 6,
  greatReviewBoost: 6,
  goodReviewBoost: 3,
  shortGameBoost: 4,
  scarceSlotBoost: 8,
  releaseYearTieThreshold: 6,
} as const;

export const QUEUE_COMMANDS = [
  "promote",
  "demote",
  "move_to_top",
  "move_to_bottom",
  "move_before",
  "move_after",
  "add_to_queue",
  "remove_from_queue",
] as const;

export const QUEUE_SORT_PRESETS = [
  "app_recommendation",
  "highest_priority",
  "highest_interest",
  "shortest_estimated",
  "least_recently_played",
  "title",
] as const;

export type QueueCommand = (typeof QUEUE_COMMANDS)[number];
export type QueueSortPreset = (typeof QUEUE_SORT_PRESETS)[number];

type QueueMoveCommand = Exclude<QueueCommand, "add_to_queue" | "remove_from_queue">;

type Distribution = {
  slots: Record<string, number>;
  completionTypes: Record<string, number>;
  total: number;
};

export function calculateCategoryDistribution(items: Pick<QueueCandidate, "backlogSlot" | "completionType">[]) {
  const distribution: Distribution = {
    slots: Object.fromEntries(BACKLOG_SLOTS.map((slot) => [slot, 0])),
    completionTypes: Object.fromEntries(COMPLETION_TYPES.map((type) => [type, 0])),
    total: items.length,
  };
  for (const item of items) {
    distribution.slots[item.backlogSlot] = (distribution.slots[item.backlogSlot] ?? 0) + 1;
    distribution.completionTypes[item.completionType] =
      (distribution.completionTypes[item.completionType] ?? 0) + 1;
  }
  return distribution;
}

export function insertGamesWithCategoryBalance(
  existingQueue: QueueCandidate[],
  newGames: QueueCandidate[],
  options: { windowSize?: number; startingRank?: number; rankStep?: number } = {},
): { queue: QueueCandidate[]; explanations: QueueExplanation[] } {
  const windowSize = options.windowSize ?? QUEUE_RULES.defaultWindowSize;
  const rankStep = options.rankStep ?? QUEUE_RULES.rankStep;
  const locked = existingQueue
    .filter((game) => game.queueLocked && game.queueRank != null)
    .sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));
  const candidates = [...existingQueue.filter((game) => !game.queueLocked), ...newGames]
    .filter((game) => game.queueRank != null || newGames.some((candidate) => candidate.id === game.id))
    .sort(compareCandidatesForStableFallback);
  const totalLength = locked.length + candidates.length;
  const target = calculateCategoryDistribution(candidates);
  const result: QueueCandidate[] = [];
  const explanations: QueueExplanation[] = [];
  let candidatePool = [...candidates];

  for (let index = 0; index < totalLength; index += 1) {
    const lockedAtPosition = locked.find((game) => rankToIndex(game.queueRank ?? 0, rankStep) === index);
    if (lockedAtPosition) {
      result.push(lockedAtPosition);
      continue;
    }
    const scored = candidatePool
      .map((candidate) => ({
        candidate,
        score: scoreCandidate(candidate, result, target, index, totalLength, windowSize),
      }))
      .sort(compareScoredCandidates);
    const next = scored[0];
    if (!next) break;
    const rank = (index + 1) * rankStep;
    result.push({ ...next.candidate, queueRank: rank });
    explanations.push({
      gameId: next.candidate.id,
      rank,
      score: Math.round(next.score),
      reason: buildReason(next.candidate, result.slice(-windowSize), target),
    });
    candidatePool = candidatePool.filter((candidate) => candidate.id !== next.candidate.id);
  }

  return {
    queue: result.map((game, index) => ({ ...game, queueRank: game.queueRank ?? (index + 1) * rankStep })),
    explanations,
  };
}

export function rebalanceQueue(queue: QueueCandidate[], options?: { windowSize?: number }) {
  return insertGamesWithCategoryBalance([], queue, options);
}

export function isQueueEligible(candidate: QueueCandidate) {
  if (candidate.currentRotation) return false;
  if (candidate.parkedForLater) return false;
  if (candidate.syncState === "ignored") return false;
  if (
    candidate.status === "completed" ||
    candidate.status === "done_for_now" ||
    candidate.status === "dnf" ||
    candidate.status === "parked" ||
    candidate.status === "wont_complete"
  ) {
    return false;
  }
  return true;
}

export function filterQueueEligibleCandidates(candidates: QueueCandidate[]) {
  return candidates.filter(isQueueEligible);
}

export function isQueueCommand(value: string): value is QueueCommand {
  return QUEUE_COMMANDS.includes(value as QueueCommand);
}

export function isQueueSortPreset(value: string): value is QueueSortPreset {
  return QUEUE_SORT_PRESETS.includes(value as QueueSortPreset);
}

export function rankQueueSequentially(
  queue: QueueCandidate[],
  options: { rankStep?: number } = {},
) {
  const rankStep = options.rankStep ?? QUEUE_RULES.rankStep;
  const locked = queue.filter((game) => game.queueLocked && game.queueRank != null);
  const lockedByPosition = new Map<number, QueueCandidate>();
  for (const game of locked) {
    lockedByPosition.set(rankToIndex(game.queueRank ?? 0, rankStep), game);
  }

  const movable = queue.filter((game) => !game.queueLocked);
  const maxLockedPosition = Math.max(-1, ...[...lockedByPosition.keys()]);
  const slotCount = Math.max(queue.length, maxLockedPosition + 1);
  const ranked: QueueCandidate[] = [];
  let movableIndex = 0;

  for (let index = 0; index < slotCount; index += 1) {
    const lockedAtPosition = lockedByPosition.get(index);
    if (lockedAtPosition) {
      ranked.push(lockedAtPosition);
      continue;
    }
    const next = movable[movableIndex];
    if (!next) continue;
    ranked.push({ ...next, queueRank: (index + 1) * rankStep });
    movableIndex += 1;
  }

  let overflowIndex = slotCount;
  while (movableIndex < movable.length) {
    ranked.push({ ...movable[movableIndex], queueRank: (overflowIndex + 1) * rankStep });
    movableIndex += 1;
    overflowIndex += 1;
  }

  return ranked.sort((a, b) => (a.queueRank ?? Number.MAX_SAFE_INTEGER) - (b.queueRank ?? Number.MAX_SAFE_INTEGER));
}

export function reorderQueueByCommand(
  queue: QueueCandidate[],
  input: { gameId: string; command: QueueMoveCommand; targetGameId?: string },
  options: { rankStep?: number } = {},
) {
  const ordered = normalizeQueued(queue);
  const movable = ordered.filter((game) => !game.queueLocked);
  const moving = movable.find((game) => game.id === input.gameId);
  if (!moving) return rankQueueSequentially(ordered, options);

  const nextMovable = movable.filter((game) => game.id !== input.gameId);
  const currentIndex = movable.findIndex((game) => game.id === input.gameId);

  if (input.command === "promote") {
    nextMovable.splice(Math.max(0, currentIndex - 1), 0, moving);
  } else if (input.command === "demote") {
    nextMovable.splice(Math.min(nextMovable.length, currentIndex + 1), 0, moving);
  } else if (input.command === "move_to_top") {
    nextMovable.unshift(moving);
  } else if (input.command === "move_to_bottom") {
    nextMovable.push(moving);
  } else {
    const targetIndex = nextMovable.findIndex((game) => game.id === input.targetGameId);
    if (targetIndex === -1) return rankQueueSequentially(ordered, options);
    nextMovable.splice(input.command === "move_before" ? targetIndex : targetIndex + 1, 0, moving);
  }

  return rankQueueSequentially(rebuildQueueWithMovableOrder(ordered, nextMovable), options);
}

export function sortQueueByPreset(
  queue: QueueCandidate[],
  preset: QueueSortPreset,
  options: { rankStep?: number; windowSize?: number } = {},
) {
  if (preset === "app_recommendation") return rebalanceQueue(queue, { windowSize: options.windowSize }).queue;

  const ordered = normalizeQueued(queue);
  const orderIndex = new Map(ordered.map((game, index) => [game.id, index]));
  const movable = ordered
    .filter((game) => !game.queueLocked)
    .sort((a, b) => compareForSortPreset(a, b, preset, orderIndex));

  return rankQueueSequentially(rebuildQueueWithMovableOrder(ordered, movable), options);
}

function rankToIndex(rank: number, rankStep: number) {
  return Math.max(0, Math.round(rank / rankStep) - 1);
}

function scoreCandidate(
  candidate: QueueCandidate,
  placed: QueueCandidate[],
  target: Distribution,
  index: number,
  totalLength: number,
  windowSize: number,
) {
  const recent = placed.slice(-windowSize);
  const placedDistribution = calculateCategoryDistribution(placed);
  const targetSlotShare = target.total === 0 ? 0 : (target.slots[candidate.backlogSlot] ?? 0) / target.total;
  const expectedSlotCount = targetSlotShare * (index + 1);
  const slotNeed = expectedSlotCount - (placedDistribution.slots[candidate.backlogSlot] ?? 0);
  const targetTypeShare =
    target.total === 0 ? 0 : (target.completionTypes[candidate.completionType] ?? 0) / target.total;
  const expectedTypeCount = targetTypeShare * (index + 1);
  const typeNeed = expectedTypeCount - (placedDistribution.completionTypes[candidate.completionType] ?? 0);
  const repeatSlotPenalty =
    recent.filter((item) => item.backlogSlot === candidate.backlogSlot).length * QUEUE_RULES.repeatSlotPenalty;
  const repeatTypePenalty =
    recent.filter((item) => item.completionType === candidate.completionType).length *
    QUEUE_RULES.repeatTypePenalty;
  const tagPenalty = recent.some((item) => hasTagOverlap(item.tags, candidate.tags))
    ? QUEUE_RULES.tagOverlapPenalty
    : 0;
  const interestBoost =
    candidate.personalInterest === "high"
      ? QUEUE_RULES.highInterestBoost
      : candidate.personalInterest === "medium"
        ? QUEUE_RULES.mediumInterestBoost
        : 0;
  const startedGameBoost = (candidate.playtimeMinutes ?? 0) > 0 ? QUEUE_RULES.startedGameBoost : 0;
  const reviewBoost =
    (candidate.steamReviewScore ?? 0) >= 90
      ? QUEUE_RULES.greatReviewBoost
      : (candidate.steamReviewScore ?? 0) >= 80
        ? QUEUE_RULES.goodReviewBoost
        : 0;
  const lengthBoost = candidate.estimatedHours && candidate.estimatedHours <= 12 ? QUEUE_RULES.shortGameBoost : 0;
  const scarcityBoost = (target.slots[candidate.backlogSlot] ?? 0) <= 2 ? QUEUE_RULES.scarceSlotBoost : 0;
  const positionPressure =
    totalLength > 0 ? (1 - index / totalLength) * candidate.priorityScore * QUEUE_RULES.positionPressureWeight : 0;

  return (
    candidate.priorityScore * QUEUE_RULES.priorityWeight +
    positionPressure +
    slotNeed * QUEUE_RULES.slotNeedWeight +
    typeNeed * QUEUE_RULES.completionTypeNeedWeight +
    interestBoost +
    startedGameBoost +
    reviewBoost +
    lengthBoost +
    scarcityBoost -
    repeatSlotPenalty -
    repeatTypePenalty -
    tagPenalty
  );
}

function hasTagOverlap(a?: string[] | null, b?: string[] | null) {
  if (!a?.length || !b?.length) return false;
  const bSet = new Set(b.map((tag) => tag.toLowerCase()));
  return a.some((tag) => bSet.has(tag.toLowerCase()));
}

function buildReason(candidate: QueueCandidate, recent: QueueCandidate[], target: Distribution) {
  const categoryCount = target.slots[candidate.backlogSlot] ?? 0;
  const recentSameSlot = recent.filter((item) => item.backlogSlot === candidate.backlogSlot).length;
  const interest = INTEREST_LABELS[candidate.personalInterest] ?? candidate.personalInterest;
  if (recentSameSlot <= 1 && categoryCount > 2) {
    return `${SLOT_LABELS[candidate.backlogSlot]} is interleaved instead of clustered; interest ${interest}, priority ${candidate.priorityScore}.`;
  }
  return `${SLOT_LABELS[candidate.backlogSlot]} fills category balance at this position; interest ${interest}, priority ${candidate.priorityScore}.`;
}

function compareScoredCandidates(
  a: { candidate: QueueCandidate; score: number },
  b: { candidate: QueueCandidate; score: number },
) {
  const scoreDifference = b.score - a.score;
  if (Math.abs(scoreDifference) > QUEUE_RULES.releaseYearTieThreshold) return scoreDifference;
  const releaseOrder = compareReleaseYear(a.candidate, b.candidate);
  if (releaseOrder !== 0) return releaseOrder;
  return compareCandidatesForStableFallback(a.candidate, b.candidate);
}

function compareCandidatesForStableFallback(a: QueueCandidate, b: QueueCandidate) {
  const priority = b.priorityScore - a.priorityScore;
  if (priority !== 0) return priority;
  const releaseOrder = compareReleaseYear(a, b);
  if (releaseOrder !== 0) return releaseOrder;
  const dateAdded = compareDateAdded(a, b);
  if (dateAdded !== 0) return dateAdded;
  return a.title.localeCompare(b.title);
}

function compareReleaseYear(a: QueueCandidate, b: QueueCandidate) {
  if (a.releaseYear != null && b.releaseYear != null && a.releaseYear !== b.releaseYear) {
    return a.releaseYear - b.releaseYear;
  }
  if (a.releaseYear != null && b.releaseYear == null) return -1;
  if (a.releaseYear == null && b.releaseYear != null) return 1;
  return 0;
}

function compareDateAdded(a: QueueCandidate, b: QueueCandidate) {
  const aTime = dateAddedTime(a.dateAdded);
  const bTime = dateAddedTime(b.dateAdded);
  if (aTime !== bTime) return aTime - bTime;
  return 0;
}

function dateAddedTime(value: QueueCandidate["dateAdded"]) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const date = typeof value === "string" ? new Date(value) : value;
  const time = date.getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function normalizeQueued(queue: QueueCandidate[]) {
  return queue
    .filter((game) => game.queueRank != null)
    .sort((a, b) => {
      const rank = (a.queueRank ?? Number.MAX_SAFE_INTEGER) - (b.queueRank ?? Number.MAX_SAFE_INTEGER);
      if (rank !== 0) return rank;
      return a.title.localeCompare(b.title);
    });
}

function rebuildQueueWithMovableOrder(ordered: QueueCandidate[], movable: QueueCandidate[]) {
  const movableQueue = [...movable];
  return ordered.map((game) => (game.queueLocked ? game : movableQueue.shift() ?? game));
}

function compareForSortPreset(
  a: QueueCandidate,
  b: QueueCandidate,
  preset: Exclude<QueueSortPreset, "app_recommendation">,
  orderIndex: Map<string, number>,
) {
  const stable = () => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0);
  if (preset === "highest_priority") {
    const priority = b.priorityScore - a.priorityScore;
    return priority || stable();
  }
  if (preset === "highest_interest") {
    const interest = interestRank(b.personalInterest) - interestRank(a.personalInterest);
    return interest || b.priorityScore - a.priorityScore || stable();
  }
  if (preset === "shortest_estimated") {
    const hours = estimatedHoursForSort(a) - estimatedHoursForSort(b);
    return hours || stable();
  }
  if (preset === "least_recently_played") {
    const played = lastPlayedTime(a.lastPlayed) - lastPlayedTime(b.lastPlayed);
    return played || stable();
  }
  return a.title.localeCompare(b.title) || stable();
}

function interestRank(value: QueueCandidate["personalInterest"]) {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  if (value === "low") return 1;
  return 0;
}

function estimatedHoursForSort(candidate: QueueCandidate) {
  return candidate.estimatedHours ?? Number.MAX_SAFE_INTEGER;
}

function lastPlayedTime(value: QueueCandidate["lastPlayed"]) {
  if (!value) return Number.MIN_SAFE_INTEGER;
  const date = typeof value === "string" ? new Date(value) : value;
  const time = date.getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

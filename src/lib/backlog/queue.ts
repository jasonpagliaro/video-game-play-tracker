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
  if (candidate.syncState === "ignored") return false;
  if (
    candidate.status === "completed" ||
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

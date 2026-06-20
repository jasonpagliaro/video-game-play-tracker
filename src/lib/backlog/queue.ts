import { BACKLOG_SLOTS, COMPLETION_TYPES, INTEREST_LABELS, SLOT_LABELS } from "./constants";
import type { QueueCandidate, QueueExplanation } from "./types";

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
  const windowSize = options.windowSize ?? 5;
  const rankStep = options.rankStep ?? 1000;
  const locked = existingQueue
    .filter((game) => game.queueLocked && game.queueRank != null)
    .sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));
  const candidates = [...existingQueue.filter((game) => !game.queueLocked), ...newGames]
    .filter((game) => game.queueRank != null || newGames.some((candidate) => candidate.id === game.id))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.title.localeCompare(b.title));
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
      .sort((a, b) => b.score - a.score || b.candidate.priorityScore - a.candidate.priorityScore || a.candidate.title.localeCompare(b.candidate.title));
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
  const repeatSlotPenalty = recent.filter((item) => item.backlogSlot === candidate.backlogSlot).length * 18;
  const repeatTypePenalty =
    recent.filter((item) => item.completionType === candidate.completionType).length * 9;
  const tagPenalty = recent.some((item) => hasTagOverlap(item.tags, candidate.tags)) ? 8 : 0;
  const interestBoost = candidate.personalInterest === "high" ? 16 : candidate.personalInterest === "medium" ? 7 : 0;
  const lengthBoost = candidate.estimatedHours && candidate.estimatedHours <= 12 ? 4 : 0;
  const scarcityBoost = (target.slots[candidate.backlogSlot] ?? 0) <= 2 ? 8 : 0;
  const positionPressure = totalLength > 0 ? (1 - index / totalLength) * candidate.priorityScore * 0.2 : 0;

  return (
    candidate.priorityScore +
    positionPressure +
    slotNeed * 28 +
    typeNeed * 14 +
    interestBoost +
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


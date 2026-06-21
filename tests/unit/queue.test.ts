import { describe, expect, it } from "vitest";

import {
  calculateCategoryDistribution,
  filterQueueEligibleCandidates,
  insertGamesWithCategoryBalance,
} from "@/lib/backlog/queue";
import type { QueueCandidate } from "@/lib/backlog/types";

function game(
  id: string,
  slot: QueueCandidate["backlogSlot"],
  priorityScore = 50,
  overrides: Partial<QueueCandidate> = {},
): QueueCandidate {
  return {
    id,
    title: id,
    backlogSlot: slot,
    completionType: "completable",
    priorityScore,
    personalInterest: "medium",
    estimatedHours: null,
    queueLocked: false,
    queueRank: null,
    ...overrides,
  };
}

describe("queue balancing", () => {
  it("calculates slot and type distributions", () => {
    const distribution = calculateCategoryDistribution([game("a", "action"), game("b", "puzzle")]);
    expect(distribution.total).toBe(2);
    expect(distribution.slots.action).toBe(1);
    expect(distribution.slots.puzzle).toBe(1);
    expect(distribution.completionTypes.completable).toBe(2);
  });

  it("interleaves overrepresented slots instead of dumping them at the end", () => {
    const candidates = [
      game("action-1", "action", 95),
      game("action-2", "action", 94),
      game("action-3", "action", 93),
      game("puzzle-1", "puzzle", 70),
      game("short-1", "short", 65),
    ];
    const { queue } = insertGamesWithCategoryBalance([], candidates, { windowSize: 3 });
    const slots = queue.map((item) => item.backlogSlot);
    expect(slots.slice(0, 4)).toContain("puzzle");
    expect(slots.slice(0, 4)).toContain("short");
    expect(queue.every((item) => item.queueRank != null)).toBe(true);
  });

  it("preserves locked positions", () => {
    const locked = { ...game("locked", "horror"), queueLocked: true, queueRank: 1000 };
    const { queue } = insertGamesWithCategoryBalance([locked], [game("a", "action"), game("b", "puzzle")]);
    expect(queue[0]?.id).toBe("locked");
  });

  it("filters terminal, active, and ignored games out of auto-queue candidates", () => {
    const candidates = [
      game("ready", "action", 50, { status: "not_started" }),
      game("done", "action", 90, { status: "completed" }),
      game("dnf", "action", 90, { status: "dnf" }),
      game("parked", "action", 90, { status: "parked" }),
      game("wont", "action", 90, { status: "wont_complete" }),
      game("active", "action", 90, { currentRotation: true }),
      game("ignored", "action", 90, { syncState: "ignored" }),
    ];

    expect(filterQueueEligibleCandidates(candidates).map((candidate) => candidate.id)).toEqual(["ready"]);
  });

  it("uses release year as a close-score tie breaker", () => {
    const { queue } = insertGamesWithCategoryBalance(
      [],
      [
        game("newer", "action", 70, { releaseYear: 2020 }),
        game("older", "action", 70, { releaseYear: 1998 }),
      ],
    );

    expect(queue[0]?.id).toBe("older");
  });

  it("falls back to date added and title for stable ordering", () => {
    const { queue } = insertGamesWithCategoryBalance(
      [],
      [
        game("second", "puzzle", 70, { dateAdded: new Date("2024-01-02") }),
        game("first", "puzzle", 70, { dateAdded: new Date("2024-01-01") }),
      ],
    );

    expect(queue.map((item) => item.id)).toEqual(["first", "second"]);
  });
});

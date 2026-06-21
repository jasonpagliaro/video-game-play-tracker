import { describe, expect, it } from "vitest";

import {
  calculateCategoryDistribution,
  filterQueueEligibleCandidates,
  insertGamesWithCategoryBalance,
  rankQueueSequentially,
  reorderQueueByCommand,
  sortQueueByPreset,
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
    lastPlayed: null,
    ...overrides,
  };
}

function queued(ids: string[]) {
  return ids.map((id, index) => game(id, "action", 50, { queueRank: (index + 1) * 1000 }));
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
      game("done-for-now", "action", 90, { status: "done_for_now" }),
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

  it("promotes, demotes, and moves queued games without accepting a raw rank", () => {
    expect(reorderQueueByCommand(queued(["a", "b", "c"]), { gameId: "b", command: "promote" }).map((item) => item.id))
      .toEqual(["b", "a", "c"]);
    expect(reorderQueueByCommand(queued(["a", "b", "c"]), { gameId: "b", command: "demote" }).map((item) => item.id))
      .toEqual(["a", "c", "b"]);
    expect(reorderQueueByCommand(queued(["a", "b", "c"]), { gameId: "c", command: "move_to_top" }).map((item) => item.id))
      .toEqual(["c", "a", "b"]);
    expect(reorderQueueByCommand(queued(["a", "b", "c"]), { gameId: "a", command: "move_to_bottom" }).map((item) => item.id))
      .toEqual(["b", "c", "a"]);
  });

  it("moves queued games before or after another queued game", () => {
    expect(
      reorderQueueByCommand(queued(["a", "b", "c", "d"]), {
        gameId: "d",
        command: "move_before",
        targetGameId: "b",
      }).map((item) => item.id),
    ).toEqual(["a", "d", "b", "c"]);
    expect(
      reorderQueueByCommand(queued(["a", "b", "c", "d"]), {
        gameId: "a",
        command: "move_after",
        targetGameId: "c",
      }).map((item) => item.id),
    ).toEqual(["b", "c", "a", "d"]);
  });

  it("recomputes stable internal ranks while preserving locked positions", () => {
    const queue = [
      game("a", "action", 50, { queueRank: 1000 }),
      game("locked", "horror", 50, { queueLocked: true, queueRank: 2000 }),
      game("b", "puzzle", 50, { queueRank: 3000 }),
    ];

    const ranked = rankQueueSequentially([queue[2], queue[0], queue[1]]);

    expect(ranked.map((item) => [item.id, item.queueRank])).toEqual([
      ["b", 1000],
      ["locked", 2000],
      ["a", 3000],
    ]);
  });

  it("keeps locked items fixed while sorting movable queue items", () => {
    const queue = [
      game("low", "action", 10, { queueRank: 1000 }),
      game("locked", "horror", 1, { queueLocked: true, queueRank: 2000 }),
      game("high", "puzzle", 90, { queueRank: 3000 }),
    ];

    expect(sortQueueByPreset(queue, "highest_priority").map((item) => [item.id, item.queueRank])).toEqual([
      ["high", 1000],
      ["locked", 2000],
      ["low", 3000],
    ]);
  });

  it("sorts queue by each persistent preset deterministically", () => {
    const queue = [
      game("medium-long", "action", 30, {
        personalInterest: "medium",
        estimatedHours: 40,
        lastPlayed: new Date("2024-01-01"),
        queueRank: 1000,
      }),
      game("high-short-never", "puzzle", 80, {
        personalInterest: "high",
        estimatedHours: 6,
        lastPlayed: null,
        queueRank: 2000,
      }),
      game("low-short-old", "short", 95, {
        personalInterest: "low",
        estimatedHours: 4,
        lastPlayed: new Date("2020-01-01"),
        queueRank: 3000,
      }),
    ];

    expect(sortQueueByPreset(queue, "highest_priority").map((item) => item.id)).toEqual([
      "low-short-old",
      "high-short-never",
      "medium-long",
    ]);
    expect(sortQueueByPreset(queue, "highest_interest").map((item) => item.id)).toEqual([
      "high-short-never",
      "medium-long",
      "low-short-old",
    ]);
    expect(sortQueueByPreset(queue, "shortest_estimated").map((item) => item.id)).toEqual([
      "low-short-old",
      "high-short-never",
      "medium-long",
    ]);
    expect(sortQueueByPreset(queue, "least_recently_played").map((item) => item.id)).toEqual([
      "high-short-never",
      "low-short-old",
      "medium-long",
    ]);
    expect(sortQueueByPreset(queue, "title").map((item) => item.id)).toEqual([
      "high-short-never",
      "low-short-old",
      "medium-long",
    ]);
  });
});

import { describe, expect, it } from "vitest";

import { isDoneForNowCandidate, transitionGameStatus } from "@/lib/backlog/status";
import { defaultSettings } from "@/lib/db/repository";

const baseGame = {
  status: "in_progress" as const,
  installed: true,
  currentRotation: true,
  dateStarted: null,
  dateCompleted: null,
  dateDnf: null,
  queueRank: 1000,
  dnfReason: null,
};

describe("status transitions", () => {
  it("completion clears rotation and queue", () => {
    const patch = transitionGameStatus({
      game: baseGame,
      newStatus: "completed",
      settings: defaultSettings(),
      activeCount: 1,
      now: new Date("2026-01-01"),
    });
    expect(patch.currentRotation).toBe(false);
    expect(patch.queueRank).toBeNull();
    expect(patch.installed).toBe(false);
    expect(patch.dateCompleted?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("done for now clears rotation and queue as a completed-adjacent status", () => {
    const patch = transitionGameStatus({
      game: baseGame,
      newStatus: "done_for_now",
      settings: defaultSettings(),
      activeCount: 1,
      now: new Date("2026-01-01"),
    });
    expect(patch.currentRotation).toBe(false);
    expect(patch.queueRank).toBeNull();
    expect(patch.installed).toBe(false);
    expect(patch.dateCompleted?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("requires a DNF reason", () => {
    expect(() =>
      transitionGameStatus({
        game: baseGame,
        newStatus: "dnf",
        settings: defaultSettings(),
        activeCount: 1,
      }),
    ).toThrow("DNF requires a reason.");
  });

  it("requires replacement when starting and active rotation is full", () => {
    const patch = transitionGameStatus({
      game: { ...baseGame, currentRotation: false, status: "not_started" },
      newStatus: "in_progress",
      settings: { ...defaultSettings(), maxActiveRotationCount: 1 },
      activeCount: 1,
    });
    expect(patch.needsReplacement).toBe(true);
    expect(patch.installed).toBe(true);
  });

  it("identifies open-ended played games as done-for-now candidates", () => {
    expect(
      isDoneForNowCandidate({
        completionType: "sandbox",
        currentRotation: false,
        playtimeMinutes: 240,
        queueRank: null,
        status: "parked",
        syncState: "synced",
      }),
    ).toBe(true);
    expect(
      isDoneForNowCandidate({
        completionType: "sandbox",
        currentRotation: false,
        playtimeMinutes: 240,
        queueRank: null,
        status: "done_for_now",
        syncState: "synced",
      }),
    ).toBe(false);
    expect(
      isDoneForNowCandidate({
        completionType: "completable",
        currentRotation: false,
        playtimeMinutes: 240,
        queueRank: null,
        status: "parked",
        syncState: "synced",
      }),
    ).toBe(false);
  });
});

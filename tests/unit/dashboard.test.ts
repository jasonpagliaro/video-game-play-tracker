import { describe, expect, it } from "vitest";

import { getDashboardSummary } from "@/lib/backlog/dashboard";
import type { GameSummary } from "@/lib/backlog/types";
import { defaultSettings } from "@/lib/db/repository";

function game(overrides: Partial<GameSummary> = {}): GameSummary {
  const id = overrides.id ?? "game";
  return {
    id,
    title: overrides.title ?? id,
    steamAppId: overrides.steamAppId ?? 100,
    status: overrides.status ?? "not_started",
    installed: overrides.installed ?? false,
    currentRotation: overrides.currentRotation ?? false,
    backlogSlot: overrides.backlogSlot ?? "action",
    completionType: overrides.completionType ?? "completable",
    priorityScore: overrides.priorityScore ?? 50,
    queueRank: overrides.queueRank ?? null,
    queueLocked: overrides.queueLocked ?? false,
    rotationSkipCount: overrides.rotationSkipCount ?? 0,
    rotationSkipUntil: overrides.rotationSkipUntil ?? null,
    rotationLastSkippedAt: overrides.rotationLastSkippedAt ?? null,
    parkedForLater: overrides.parkedForLater ?? false,
    reassessAfter: overrides.reassessAfter ?? null,
    personalInterest: overrides.personalInterest ?? "medium",
    playtimeMinutes: overrides.playtimeMinutes ?? 0,
    achievementPercent: overrides.achievementPercent ?? null,
    estimatedHours: overrides.estimatedHours ?? null,
    steamReviewScore: overrides.steamReviewScore ?? null,
    steamReviewSummary: overrides.steamReviewSummary ?? null,
    releaseYear: overrides.releaseYear ?? null,
    lastPlayed: overrides.lastPlayed ?? null,
    dateAdded: overrides.dateAdded ?? null,
    lastSyncedAt: overrides.lastSyncedAt ?? null,
    syncState: overrides.syncState ?? "synced",
    steamid64Owner: overrides.steamid64Owner ?? null,
    notes: overrides.notes ?? null,
    dnfReason: overrides.dnfReason ?? null,
  };
}

describe("dashboard summary", () => {
  it("handles an empty backlog", () => {
    const summary = getDashboardSummary([], defaultSettings());

    expect(summary.counts.totalGames).toBe(0);
    expect(summary.queue.total).toBe(0);
    expect(summary.queue.nextWindowCount).toBe(0);
    expect(summary.queue.eligibleUnqueued).toBe(0);
    expect(summary.queue.importedReview).toBe(0);
    expect(summary.queue.warningCount).toBe(0);
  });

  it("counts queued games and the configured focus window", () => {
    const settings = { ...defaultSettings(), queueSlidingWindowSize: 3 };
    const summary = getDashboardSummary(
      [
        game({ id: "q1", queueRank: 1000 }),
        game({ id: "q2", queueRank: 2000 }),
        game({ id: "q3", queueRank: 3000 }),
        game({ id: "q4", queueRank: 4000 }),
      ],
      settings,
    );

    expect(summary.queue.total).toBe(4);
    expect(summary.queue.windowSize).toBe(3);
    expect(summary.queue.nextWindowCount).toBe(3);
    expect(summary.nextWindowGames.map((item) => item.id)).toEqual(["q1", "q2", "q3"]);
  });

  it("excludes terminal and held ranked games from queue totals", () => {
    const summary = getDashboardSummary(
      [
        game({ id: "ready", queueRank: 1000, backlogSlot: "action" }),
        game({ id: "completed", status: "completed", queueRank: 2000, backlogSlot: "action" }),
        game({ id: "done-now", status: "done_for_now", queueRank: 3000, backlogSlot: "action" }),
        game({ id: "dnf", status: "dnf", queueRank: 4000, backlogSlot: "action" }),
        game({ id: "parked", status: "parked", queueRank: 5000, backlogSlot: "action" }),
        game({ id: "wont", status: "wont_complete", queueRank: 6000, backlogSlot: "action" }),
        game({ id: "held", parkedForLater: true, queueRank: 7000, backlogSlot: "action" }),
        game({ id: "active", currentRotation: true, queueRank: 8000, backlogSlot: "action" }),
        game({ id: "ignored", syncState: "ignored", queueRank: 9000, backlogSlot: "action" }),
      ],
      defaultSettings(),
    );

    expect(summary.queue.total).toBe(1);
    expect(summary.queue.warningCount).toBe(0);
    expect(summary.nextWindowGames.map((item) => item.id)).toEqual(["ready"]);
  });

  it("excludes active, terminal, parked, and ignored games from eligible unqueued totals", () => {
    const summary = getDashboardSummary(
      [
        game({ id: "ready", queueRank: null }),
        game({ id: "active", currentRotation: true }),
        game({ id: "completed", status: "completed" }),
        game({ id: "done-now", status: "done_for_now" }),
        game({ id: "dnf", status: "dnf" }),
        game({ id: "parked", status: "parked" }),
        game({ id: "wont", status: "wont_complete" }),
        game({ id: "ignored", syncState: "ignored" }),
        game({ id: "already-queued", queueRank: 1000 }),
      ],
      defaultSettings(),
    );

    expect(summary.queue.eligibleUnqueued).toBe(1);
  });

  it("counts imported games that still need queue review", () => {
    const summary = getDashboardSummary(
      [
        game({ id: "imported-ready", syncState: "imported" }),
        game({ id: "imported-active", syncState: "imported", currentRotation: true }),
        game({ id: "imported-queued", syncState: "imported", queueRank: 1000 }),
        game({ id: "synced-ready", syncState: "synced" }),
      ],
      defaultSettings(),
    );

    expect(summary.queue.importedReview).toBe(1);
  });

  it("reports queue warnings from existing warning summaries", () => {
    const summary = getDashboardSummary(
      [
        game({ id: "q1", queueRank: 1000, backlogSlot: "action" }),
        game({ id: "q2", queueRank: 2000, backlogSlot: "action" }),
        game({ id: "q3", queueRank: 3000, backlogSlot: "action" }),
        game({ id: "q4", queueRank: 4000, backlogSlot: "action" }),
      ],
      defaultSettings(),
    );

    expect(summary.queue.warningCount).toBe(1);
  });
});

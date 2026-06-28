import { describe, expect, it } from "vitest";

import {
  buildParkForLaterPatch,
  buildReturnFromParkedPatch,
  buildRotationSkipPatch,
  getOpenRotationSlots,
  getRotationFillCandidates,
  isParkedReassessmentDue,
  requiresRotationDecision,
} from "@/lib/backlog/rotation-fill";
import type { GameSummary } from "@/lib/backlog/types";
import { defaultSettings } from "@/lib/db/repository";

const now = new Date("2026-06-21T12:00:00Z");

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
    queueRank: "queueRank" in overrides ? (overrides.queueRank ?? null) : 1000,
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
    steamDeckCompatibilityCategory: overrides.steamDeckCompatibilityCategory ?? null,
    steamDeckCompatibilityItems: overrides.steamDeckCompatibilityItems ?? null,
    protondbTier: overrides.protondbTier ?? null,
    protondbConfidence: overrides.protondbConfidence ?? null,
    protondbScore: overrides.protondbScore ?? null,
    protondbReportCount: overrides.protondbReportCount ?? null,
    deckPlayabilityUpdatedAt: overrides.deckPlayabilityUpdatedAt ?? null,
    deckPlayabilityRaw: overrides.deckPlayabilityRaw ?? null,
    lastPlayed: overrides.lastPlayed ?? null,
    dateAdded: overrides.dateAdded ?? null,
    lastSyncedAt: overrides.lastSyncedAt ?? null,
    syncState: overrides.syncState ?? "synced",
    steamid64Owner: overrides.steamid64Owner ?? null,
    notes: overrides.notes ?? null,
    dnfReason: overrides.dnfReason ?? null,
  };
}

describe("rotation fill", () => {
  it("selects queued candidates by queue order up to active capacity", () => {
    const settings = { ...defaultSettings(), maxActiveRotationCount: 3 };
    const candidates = getRotationFillCandidates(
      [
        game({ id: "active", currentRotation: true, queueRank: null }),
        game({ id: "third", queueRank: 3000 }),
        game({ id: "first", queueRank: 1000 }),
        game({ id: "second", queueRank: 2000 }),
      ],
      settings,
      { now },
    );

    expect(getOpenRotationSlots([game({ currentRotation: true })], settings)).toBe(2);
    expect(candidates.map((candidate) => candidate.id)).toEqual(["first", "second"]);
  });

  it("excludes skipped, terminal, parked, ignored, unqueued, and active games", () => {
    const settings = { ...defaultSettings(), maxActiveRotationCount: 5 };
    const candidates = getRotationFillCandidates(
      [
        game({ id: "ready", queueRank: 1000 }),
        game({ id: "skipped", queueRank: 2000, rotationSkipUntil: new Date("2026-09-01T00:00:00Z") }),
        game({ id: "completed", queueRank: 3000, status: "completed" }),
        game({ id: "parked", queueRank: 4000, status: "parked" }),
        game({ id: "parked-later", queueRank: 5000, parkedForLater: true }),
        game({ id: "ignored", queueRank: 6000, syncState: "ignored" }),
        game({ id: "unqueued", queueRank: null }),
        game({ id: "active", queueRank: 7000, currentRotation: true }),
      ],
      settings,
      { now },
    );

    expect(candidates.map((candidate) => candidate.id)).toEqual(["ready"]);
  });

  it("increments skip count and sets cooldown without changing queue rank", () => {
    const settings = { ...defaultSettings(), rotationSkipCooldownDays: 90 };
    const target = game({ rotationSkipCount: 2, queueRank: 1000 });
    const patch = buildRotationSkipPatch(target, settings, now);

    expect(patch.rotationSkipCount).toBe(3);
    expect(patch.rotationSkipUntil?.toISOString()).toBe("2026-09-19T12:00:00.000Z");
    expect(patch.queueRank).toBeUndefined();
  });

  it("forces a keep, park, or won't-complete decision after the skip limit", () => {
    const settings = { ...defaultSettings(), rotationSkipLimit: 3 };
    const target = game({ rotationSkipCount: 3 });

    expect(requiresRotationDecision(target, settings)).toBe(true);
    expect(() => buildRotationSkipPatch(target, settings, now)).toThrow(/needs a keep/i);
  });

  it("parks for later with reassessment metadata and clears skip state", () => {
    const settings = { ...defaultSettings(), parkedReassessmentDays: 180 };
    const patch = buildParkForLaterPatch(settings, now);

    expect(patch.status).toBe("parked");
    expect(patch.queueRank).toBeNull();
    expect(patch.parkedForLater).toBe(true);
    expect(patch.rotationSkipCount).toBe(0);
    expect(patch.reassessAfter?.toISOString()).toBe("2026-12-18T12:00:00.000Z");
  });

  it("identifies due parked reassessments and builds the return-to-queue reset patch", () => {
    const due = game({ status: "parked", parkedForLater: true, reassessAfter: new Date("2026-06-01T00:00:00Z") });
    const notDue = game({ status: "parked", parkedForLater: true, reassessAfter: new Date("2026-07-01T00:00:00Z") });
    const patch = buildReturnFromParkedPatch();

    expect(isParkedReassessmentDue(due, now)).toBe(true);
    expect(isParkedReassessmentDue(notDue, now)).toBe(false);
    expect(patch.status).toBe("not_started");
    expect(patch.parkedForLater).toBe(false);
    expect(patch.rotationSkipUntil).toBeNull();
  });
});

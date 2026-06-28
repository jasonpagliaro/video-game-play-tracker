import { describe, expect, it } from "vitest";

import { sortQueueByPreset } from "@/lib/backlog/queue";
import { summarizeWarnings } from "@/lib/backlog/warnings";
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

describe("warning summaries", () => {
  it("does not warn when active rotation repeats non-open-ended completion types", () => {
    const warnings = summarizeWarnings(
      [
        game({ id: "action", currentRotation: true, backlogSlot: "action", completionType: "completable" }),
        game({ id: "puzzle", currentRotation: true, backlogSlot: "puzzle", completionType: "completable" }),
        game({ id: "narrative", currentRotation: true, backlogSlot: "narrative", completionType: "completable" }),
        game({ id: "unknown", currentRotation: true, backlogSlot: "horror", completionType: "unknown" }),
      ],
      defaultSettings(),
    );

    expect(warnings.some((warning) => warning.code === "rotation_type_cluster")).toBe(false);
  });

  it("warns when active rotation repeats an open-ended completion type", () => {
    const warnings = summarizeWarnings(
      [
        game({ id: "live-1", currentRotation: true, backlogSlot: "action", completionType: "live_service" }),
        game({ id: "live-2", currentRotation: true, backlogSlot: "puzzle", completionType: "live_service" }),
        game({ id: "live-3", currentRotation: true, backlogSlot: "narrative", completionType: "live_service" }),
      ],
      defaultSettings(),
    );
    const warning = warnings.find((item) => item.code === "rotation_type_cluster");

    expect(warning?.title).toBe("Active rotation repeats open-ended completion type");
    expect(warning?.detail).toContain("Live Service");
  });

  it("does not warn after an auto-healable queue is rebalanced", () => {
    const queue = sortQueueByPreset(
      [
        game({ id: "action-1", queueRank: 1000, backlogSlot: "action", priorityScore: 100 }),
        game({ id: "action-2", queueRank: 2000, backlogSlot: "action", priorityScore: 99 }),
        game({ id: "action-3", queueRank: 3000, backlogSlot: "action", priorityScore: 98 }),
        game({ id: "action-4", queueRank: 4000, backlogSlot: "action", priorityScore: 97 }),
        game({ id: "puzzle-1", queueRank: 5000, backlogSlot: "puzzle", priorityScore: 1 }),
      ],
      "app_recommendation",
    );

    const warnings = summarizeWarnings(queue.map((item) => game(item)), defaultSettings());

    expect(warnings.some((warning) => warning.code === "queue_variety_poor")).toBe(false);
  });

  it("does not warn on Needs Review placeholder clusters", () => {
    const warnings = summarizeWarnings(
      [
        game({ id: "experimental-1", queueRank: 1000, backlogSlot: "experimental" }),
        game({ id: "experimental-2", queueRank: 2000, backlogSlot: "experimental" }),
        game({ id: "experimental-3", queueRank: 3000, backlogSlot: "experimental" }),
        game({ id: "experimental-4", queueRank: 4000, backlogSlot: "experimental" }),
      ],
      defaultSettings(),
    );

    expect(warnings.some((item) => item.code === "queue_variety_poor")).toBe(false);
  });

  it("uses display labels in queue cluster warnings", () => {
    const warnings = summarizeWarnings(
      [
        game({ id: "rpg-1", queueRank: 1000, backlogSlot: "rpg_long" }),
        game({ id: "rpg-2", queueRank: 2000, backlogSlot: "rpg_long" }),
        game({ id: "rpg-3", queueRank: 3000, backlogSlot: "rpg_long" }),
        game({ id: "rpg-4", queueRank: 4000, backlogSlot: "rpg_long" }),
      ],
      defaultSettings(),
    );
    const warning = warnings.find((item) => item.code === "queue_variety_poor");

    expect(warning?.detail).toContain("RPG / Long");
    expect(warning?.detail).not.toContain("rpg_long");
  });
});

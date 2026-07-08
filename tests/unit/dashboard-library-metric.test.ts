import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardOverviewStrip } from "@/components/dashboard/dashboard-overview-strip";
import { DashboardStatusGrid } from "@/components/dashboard/dashboard-status-grid";
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

describe("dashboard library queue metric", () => {
  it("shows queued games over total library with progress toward an empty queue", () => {
    const settings = defaultSettings();
    const summary = getDashboardSummary(
      [
        game({ id: "queued-1", queueRank: 1000 }),
        game({ id: "unqueued-1" }),
        game({ id: "unqueued-2" }),
        game({ id: "completed", status: "completed", queueRank: 3000 }),
      ],
      settings,
    );

    const overviewHtml = renderToStaticMarkup(createElement(DashboardOverviewStrip, { summary, settings }));
    const statusHtml = renderToStaticMarkup(createElement(DashboardStatusGrid, { summary, settings }));

    for (const html of [overviewHtml, statusHtml]) {
      expect(html).toContain("1 / 4");
      expect(html).toContain("in queue / library");
      expect(html).toContain("75% clear");
      expect(html).toContain("100% at empty queue");
      expect(html).toContain('role="meter"');
      expect(html).toContain('aria-label="Progress toward empty queue"');
      expect(html).toContain('aria-valuenow="75"');
    }
  });
});

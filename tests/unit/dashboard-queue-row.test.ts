import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardQueueRow } from "@/components/dashboard/dashboard-queue-row";
import type { GameSummary } from "@/lib/backlog/types";

const game: GameSummary = {
  id: "queue-1",
  title: "A Short Hike",
  steamAppId: 1055540,
  status: "not_started",
  installed: false,
  currentRotation: false,
  backlogSlot: "short",
  completionType: "completable",
  priorityScore: 88,
  queueRank: 1000,
  queueLocked: false,
  rotationSkipCount: 0,
  rotationSkipUntil: null,
  rotationLastSkippedAt: null,
  parkedForLater: false,
  reassessAfter: null,
  personalInterest: "high",
  playtimeMinutes: 45,
  achievementPercent: 25,
  estimatedHours: 2,
  steamReviewScore: 95,
  steamReviewSummary: "Overwhelmingly Positive",
  releaseYear: 2019,
  steamDeckCompatibilityCategory: null,
  steamDeckCompatibilityItems: null,
  protondbTier: null,
  protondbConfidence: null,
  protondbScore: null,
  protondbReportCount: null,
  deckPlayabilityUpdatedAt: null,
  deckPlayabilityRaw: null,
  lastPlayed: new Date("2026-06-20T12:00:00Z"),
  dateAdded: null,
  lastSyncedAt: null,
  syncState: "synced",
  steamid64Owner: null,
  notes: null,
  dnfReason: null,
};

describe("DashboardQueueRow", () => {
  it("renders queue games with visible playtime summary and no artwork", () => {
    const html = renderToStaticMarkup(createElement(DashboardQueueRow, { game, position: 2 }));

    expect(html).toContain("#2");
    expect(html).toContain("A Short Hike");
    expect(html).toContain("Short / Palate Cleanser");
    expect(html).toContain("Completable");
    expect(html).not.toContain("Queue priority 88");
    expect(html).not.toContain("Playtime 45m");
    expect(html).not.toContain("Est 2h");
    expect(html).toContain('data-dashboard-playtime-summary="playtime"');
    expect(html).toContain("Played");
    expect(html).toContain("45m");
    expect(html).toContain("Progress");
    expect(html).toContain("38%");
    expect(html).toContain("Remaining");
    expect(html).toContain("1.3h");
    expect(html).not.toContain('aria-expanded="false"');
    expect(html).not.toContain("Show play time details");
    expect(html).not.toContain("Play time");
    expect(html).not.toContain('data-dashboard-playtime-metrics="playtime"');
    expect(html).not.toContain("Saved estimate");
    expect(html).toContain("Open");
    expect(html).toContain("Steam");
    expect(html).not.toContain("Steam header artwork");
    expect(html).not.toContain("<img");
  });

  it("renders the official Steam Deck tag on queue rows when available", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardQueueRow, {
        game: {
          ...game,
          steamDeckCompatibilityCategory: "playable",
          protondbTier: "gold",
          protondbConfidence: "strong",
          protondbScore: 0.78,
          protondbReportCount: 20,
        },
        position: 2,
      }),
    );

    expect(html).toContain('data-dashboard-deck-badge="playability"');
    expect(html).toContain('data-dashboard-deck-summary="playability"');
    expect(html).toContain("Deck Playable");
    expect(html).toContain("Good with minor caveats");
    expect(html).toContain("Steam Playable");
    expect(html).toContain("ProtonDB Gold");
    expect(html).toContain("78%");
    expect(html).toContain("20 reports");
    expect(html).not.toContain("Deck experience");
    expect(html).not.toContain('data-dashboard-deck-metrics="playability"');
  });
});

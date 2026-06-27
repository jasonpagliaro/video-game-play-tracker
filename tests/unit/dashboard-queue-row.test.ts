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
  lastPlayed: new Date("2026-06-20T12:00:00Z"),
  dateAdded: null,
  lastSyncedAt: null,
  syncState: "synced",
  steamid64Owner: null,
  notes: null,
  dnfReason: null,
};

describe("DashboardQueueRow", () => {
  it("renders queue games with playtime metrics behind a disclosure and no artwork", () => {
    const html = renderToStaticMarkup(createElement(DashboardQueueRow, { game, position: 2 }));
    const detailsIndex = html.indexOf('data-dashboard-playtime-details="playtime"');
    const summaryIndex = html.indexOf("<summary", detailsIndex);
    const playedIndex = html.indexOf("Played", summaryIndex);

    expect(html).toContain("#2");
    expect(html).toContain("A Short Hike");
    expect(html).toContain("Short / Palate Cleanser");
    expect(html).toContain("Completable");
    expect(html).toContain("Score 88");
    expect(html).not.toContain("Playtime 45m");
    expect(html).not.toContain("Est 2h");
    expect(detailsIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(detailsIndex);
    expect(html.slice(detailsIndex, summaryIndex)).not.toContain("open");
    expect(html).toContain("Play time");
    expect(playedIndex).toBeGreaterThan(summaryIndex);
    expect(html.indexOf("45m", playedIndex)).toBeGreaterThan(playedIndex);
    expect(html).toContain("Typical");
    expect(html).toContain("2h");
    expect(html).toContain("Remaining");
    expect(html).toContain("Progress");
    expect(html).toContain("Last played");
    expect(html).toContain("Open");
    expect(html).toContain("Steam");
    expect(html).not.toContain("Steam header artwork");
    expect(html).not.toContain("<img");
  });
});

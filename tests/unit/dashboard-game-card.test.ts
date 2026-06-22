import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardGameCard } from "@/components/dashboard/dashboard-game-card";
import type { GameSummary } from "@/lib/backlog/types";

const game: GameSummary = {
  id: "game-1",
  title: "10,000,000",
  steamAppId: 227580,
  status: "not_started",
  installed: false,
  currentRotation: false,
  backlogSlot: "short",
  completionType: "needs_type",
  priorityScore: 58,
  queueRank: null,
  queueLocked: false,
  rotationSkipCount: 0,
  rotationSkipUntil: null,
  rotationLastSkippedAt: null,
  parkedForLater: false,
  reassessAfter: null,
  personalInterest: "medium",
  playtimeMinutes: 10,
  achievementPercent: null,
  estimatedHours: null,
  steamReviewScore: null,
  steamReviewSummary: null,
  releaseYear: null,
  lastPlayed: new Date("2015-01-15T00:00:00Z"),
  dateAdded: null,
  lastSyncedAt: null,
  syncState: "synced",
  steamid64Owner: null,
  notes: null,
  dnfReason: null,
};

describe("DashboardGameCard", () => {
  it("keeps playtime and lower metadata inside a closed details menu", () => {
    const html = renderToStaticMarkup(createElement(DashboardGameCard, { game }));

    const detailsIndex = html.indexOf("<details");
    const summaryIndex = html.indexOf("<summary", detailsIndex);
    const playtimeIndex = html.indexOf("Playtime");

    expect(detailsIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(detailsIndex);
    expect(playtimeIndex).toBeGreaterThan(summaryIndex);
    expect(html.slice(detailsIndex, summaryIndex)).not.toContain("open");
    expect(html).toContain("Details");
    expect(html).toContain("Steam App 227580");
    expect(html).toContain("Score 58");
  });
});

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
  completionType: "unknown",
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

  it("renders active-rotation compact cards without the details disclosure", () => {
    const html = renderToStaticMarkup(createElement(DashboardGameCard, { game, variant: "compact" }));

    expect(html).toContain('data-dashboard-card-variant="compact"');
    expect(html).toContain("10,000,000");
    expect(html).toContain("Not Started");
    expect(html).toContain("Short / Palate Cleanser");
    expect(html).toContain("Needs Type");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Details");
    expect(html).not.toContain("Steam App 227580");
    expect(html).not.toContain("Score 58");
  });

  it("renders active cards with inline progress and actions", () => {
    const html = renderToStaticMarkup(createElement(DashboardGameCard, { game, variant: "active" }));

    expect(html).toContain('data-dashboard-card-variant="active"');
    expect(html).toContain("10,000,000");
    expect(html).toContain("Played");
    expect(html).toContain("10m");
    expect(html).toContain("Ach");
    expect(html).toContain("Est");
    expect(html).toContain("Last");
    expect(html).toContain("Steam App 227580");
    expect(html).toContain("Score 58");
    expect(html).toContain("Open");
    expect(html).toContain("Steam");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Details");
  });
});

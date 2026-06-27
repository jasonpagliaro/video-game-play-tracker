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
  estimatedHours: 2,
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
  it("keeps playtime metrics and lower metadata inside closed details menus", () => {
    const html = renderToStaticMarkup(createElement(DashboardGameCard, { game }));

    const detailsIndex = html.indexOf("<details");
    const summaryIndex = html.indexOf("<summary", detailsIndex);
    const playtimeIndex = html.indexOf("Play time", summaryIndex);
    const playedIndex = html.indexOf("Played", playtimeIndex);

    expect(detailsIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(detailsIndex);
    expect(playtimeIndex).toBeGreaterThan(summaryIndex);
    expect(playedIndex).toBeGreaterThan(playtimeIndex);
    expect(html.slice(detailsIndex, summaryIndex)).not.toContain("open");
    expect(html).toContain("Details");
    expect(html).toContain("Typical");
    expect(html).toContain("Remaining");
    expect(html).toContain("Progress");
    expect(html).toContain("Steam App 227580");
    expect(html).toContain("Score 58");
  });

  it("renders active-rotation compact cards without the details disclosure", () => {
    const html = renderToStaticMarkup(createElement(DashboardGameCard, { game, variant: "compact" }));

    expect(html).toContain('data-dashboard-card-variant="compact"');
    expect(html).toContain("aspect-[92/43]");
    expect(html).toContain("object-contain");
    expect(html).toContain("(min-width: 1280px) 20vw");
    expect(html).not.toContain("object-cover");
    expect(html).not.toContain("h-24");
    expect(html).not.toContain("sm:h-28");
    expect(html).toContain("10,000,000");
    expect(html).toContain("Not Started");
    expect(html).toContain("Short / Palate Cleanser");
    expect(html).toContain("Needs Type");
    expect(html).not.toContain("<details");
    expect(html).not.toContain("Details");
    expect(html).not.toContain("Steam App 227580");
    expect(html).not.toContain("Score 58");
  });

  it("renders active cards with playtime hidden behind a disclosure and actions visible", () => {
    const html = renderToStaticMarkup(createElement(DashboardGameCard, { game, variant: "active" }));
    const badgeStripIndex = html.indexOf('data-dashboard-badge-strip="active"');
    const statusIndex = html.indexOf("Not Started", badgeStripIndex);
    const completionIndex = html.indexOf("Needs Type", badgeStripIndex);
    const slotIndex = html.indexOf("Short / Palate Cleanser", badgeStripIndex);
    const detailsIndex = html.indexOf('data-dashboard-playtime-details="playtime"');
    const summaryIndex = html.indexOf("<summary", detailsIndex);
    const playedIndex = html.indexOf("Played", summaryIndex);
    const playedValueIndex = html.indexOf("10m", playedIndex);

    expect(html).toContain('data-dashboard-card-variant="active"');
    expect(html).toContain("aspect-[92/43]");
    expect(html).toContain("object-contain");
    expect(html).toContain("(min-width: 1280px) 20vw");
    expect(html).not.toContain("object-cover");
    expect(html).not.toContain("h-20");
    expect(html).not.toContain("xl:h-16");
    expect(badgeStripIndex).toBeGreaterThan(-1);
    expect(statusIndex).toBeGreaterThan(badgeStripIndex);
    expect(completionIndex).toBeGreaterThan(statusIndex);
    expect(slotIndex).toBeGreaterThan(completionIndex);
    expect(html).toContain('data-dashboard-badge-row="state"');
    expect(html).toContain('data-dashboard-badge-row="slot"');
    expect(html).not.toContain('data-dashboard-metrics="active"');
    expect(html).toContain('data-dashboard-actions="active"');
    expect(html).toContain("10,000,000");
    expect(detailsIndex).toBeGreaterThan(-1);
    expect(summaryIndex).toBeGreaterThan(detailsIndex);
    expect(html.slice(detailsIndex, summaryIndex)).not.toContain("open");
    expect(html).toContain("Play time");
    expect(html).toContain("Played");
    expect(playedIndex).toBeGreaterThan(summaryIndex);
    expect(playedValueIndex).toBeGreaterThan(playedIndex);
    expect(html).toContain("Typical");
    expect(html).toContain("Remaining");
    expect(html).toContain("Progress");
    expect(html).toContain("Last played");
    expect(html).toContain("Steam App 227580");
    expect(html).toContain("Score 58");
    expect(html).toContain("Open");
    expect(html).toContain("Steam");
    expect(html).toContain("Install");
    expect(html).toContain("Launch");
    expect(html).toContain('href="steam://install/227580"');
    expect(html).toContain('href="steam://run/227580"');
    expect(html).toContain("<details");
  });
});

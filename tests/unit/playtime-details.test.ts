import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardPlaytimeSummary } from "@/components/dashboard/playtime-details";
import type { GameSummary } from "@/lib/backlog/types";

const baseGame: Pick<
  GameSummary,
  "playtimeMinutes" | "estimatedHours" | "lastPlayed" | "backlogSlot" | "completionType"
> = {
  playtimeMinutes: 45,
  estimatedHours: 2,
  lastPlayed: new Date("2026-06-20T12:00:00Z"),
  backlogSlot: "short",
  completionType: "completable",
};

describe("DashboardPlaytimeSummary", () => {
  it("renders progress-oriented summary chips when an estimate exists", () => {
    const html = renderToStaticMarkup(createElement(DashboardPlaytimeSummary, { game: baseGame }));

    expect(html).toContain('data-dashboard-playtime-summary="playtime"');
    expect(html).toContain("Played");
    expect(html).toContain("45m");
    expect(html).toContain("Progress");
    expect(html).toContain("38%");
    expect(html).toContain("Remaining");
    expect(html).toContain("1.3h");
    expect(html).not.toContain("Play time");
    expect(html).not.toContain("aria-expanded");
  });

  it("falls back to played time only when no estimate exists", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardPlaytimeSummary, {
        game: { ...baseGame, estimatedHours: null, backlogSlot: undefined, completionType: undefined },
      }),
    );

    expect(html).toContain("Played");
    expect(html).toContain("45m");
    expect(html).not.toContain("Progress");
    expect(html).not.toContain("Remaining");
  });

  it("shows open-ended games as ongoing", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardPlaytimeSummary, {
        game: {
          ...baseGame,
          playtimeMinutes: 600,
          estimatedHours: null,
          backlogSlot: "parking_lot",
          completionType: "live_service",
        },
      }),
    );

    expect(html).toContain("Played");
    expect(html).toContain("10h");
    expect(html).toContain("Status");
    expect(html).toContain("Ongoing");
    expect(html).not.toContain("Progress");
  });
});

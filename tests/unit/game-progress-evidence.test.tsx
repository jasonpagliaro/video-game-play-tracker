import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameProgressEvidence } from "@/components/backlog/game-progress-evidence";

const game = {
  playtimeMinutes: 45,
  estimatedHours: 2,
  lastPlayed: new Date("2026-06-20T12:00:00Z"),
  backlogSlot: "short",
  completionType: "completable",
  achievementPercent: 25,
  lastSyncedAt: new Date("2026-06-21T12:00:00Z"),
  steamReviewScore: 95,
  releaseYear: 2019,
  installed: true,
  currentRotation: true,
  steamDeckCompatibilityCategory: "verified",
  steamDeckCompatibilityItems: [
    {
      status: "pass",
      label: "Default controller config works",
      locToken: "#SteamDeckVerified_TestResult_DefaultControllerConfigFullyFunctional",
      rawDisplayType: 4,
    },
  ],
  protondbTier: "platinum",
  protondbConfidence: "strong",
  protondbScore: 0.91,
  protondbReportCount: 42,
  deckPlayabilityUpdatedAt: new Date("2026-06-27T00:00:00Z"),
} satisfies ComponentProps<typeof GameProgressEvidence>["game"];

describe("GameProgressEvidence", () => {
  it("renders computed playtime details and Deck evidence for the detail page", () => {
    const html = renderToStaticMarkup(createElement(GameProgressEvidence, { game }));

    expect(html).toContain("Steam and progress");
    expect(html).toContain("Playtime");
    expect(html).toContain("45m");
    expect(html).toContain("Progress");
    expect(html).toContain("38%");
    expect(html).toContain("Remaining");
    expect(html).toContain("1.3h");
    expect(html).toContain("Typical finish");
    expect(html).toContain("2.0h");
    expect(html).toContain("Estimate basis");
    expect(html).toContain("Saved estimate");
    expect(html).toContain("Deck experience");
    expect(html).toContain("Excellent Deck fit");
    expect(html).toContain("Steam");
    expect(html).toContain("Verified");
    expect(html).toContain("ProtonDB");
    expect(html).toContain("Platinum");
    expect(html).toContain("42 reports");
    expect(html).toContain("Default controller config works");
  });
});

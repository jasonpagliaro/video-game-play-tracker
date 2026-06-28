import { describe, expect, it } from "vitest";

import {
  extractSteamDeckCompatibilityFromHtml,
  normalizeProtonDbSummary,
} from "@/lib/steam/deck-playability-fetch";
import {
  getDeckExperienceLabel,
  normalizeSteamDeckCompatibilityCategory,
} from "@/lib/steam/deck-playability";

describe("Steam Deck playability metadata", () => {
  it("maps Steam compatibility category values and labels known criteria tokens", () => {
    const html =
      '<div data-deckcompatibility="{&quot;appid&quot;:227580,&quot;resolved_category&quot;:2,&quot;resolved_items&quot;:[{&quot;display_type&quot;:3,&quot;loc_token&quot;:&quot;#SteamDeckVerified_TestResult_NativeResolutionNotDefault&quot;},{&quot;display_type&quot;:4,&quot;loc_token&quot;:&quot;#SteamDeckVerified_TestResult_DefaultControllerConfigFullyFunctional&quot;}]}"></div>';

    const parsed = extractSteamDeckCompatibilityFromHtml(html);

    expect(parsed?.category).toBe("playable");
    expect(parsed?.items).toEqual([
      {
        status: "warning",
        label: "Native resolution is not the default",
        locToken: "#SteamDeckVerified_TestResult_NativeResolutionNotDefault",
        rawDisplayType: 3,
      },
      {
        status: "pass",
        label: "Default controller config works",
        locToken: "#SteamDeckVerified_TestResult_DefaultControllerConfigFullyFunctional",
        rawDisplayType: 4,
      },
    ]);
    expect(parsed?.raw.resolved_category).toBe(2);
  });

  it("handles category text, unknown values, missing payloads, and malformed payloads", () => {
    expect(normalizeSteamDeckCompatibilityCategory(0)).toBe("unknown");
    expect(normalizeSteamDeckCompatibilityCategory(1)).toBe("unsupported");
    expect(normalizeSteamDeckCompatibilityCategory(2)).toBe("playable");
    expect(normalizeSteamDeckCompatibilityCategory(3)).toBe("verified");
    expect(normalizeSteamDeckCompatibilityCategory("Steam Deck Verified")).toBe("verified");
    expect(normalizeSteamDeckCompatibilityCategory("not evaluated")).toBe("unknown");
    expect(extractSteamDeckCompatibilityFromHtml("<div></div>")).toBeNull();
    expect(extractSteamDeckCompatibilityFromHtml('<div data-deckcompatibility="{&quot;broken&quot;"></div>')).toBeNull();
  });

  it("normalizes ProtonDB aggregate summaries", () => {
    const summary = normalizeProtonDbSummary({
      bestReportedTier: "platinum",
      confidence: "strong",
      score: 0.78,
      tier: "gold",
      total: 2066,
      trendingTier: "platinum",
    });

    expect(summary).toMatchObject({
      tier: "gold",
      confidence: "strong",
      score: 0.78,
      reportCount: 2066,
    });
  });

  it("derives a deterministic Deck experience label from official and community signals", () => {
    expect(
      getDeckExperienceLabel({
        steamDeckCompatibilityCategory: "verified",
        protondbTier: "platinum",
        protondbConfidence: "strong",
      }),
    ).toBe("Excellent Deck fit");

    expect(
      getDeckExperienceLabel({
        steamDeckCompatibilityCategory: "playable",
        protondbTier: "gold",
        protondbConfidence: "moderate",
      }),
    ).toBe("Good with minor caveats");

    expect(
      getDeckExperienceLabel({
        steamDeckCompatibilityCategory: "unsupported",
        protondbTier: null,
        protondbConfidence: null,
      }),
    ).toBe("Poor Deck fit");
  });
});

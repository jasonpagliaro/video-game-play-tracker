import { describe, expect, it } from "vitest";

import { getPlaytimeMetrics } from "@/lib/backlog/playtime-metrics";

describe("playtime metrics", () => {
  it("falls back to a category estimate when no saved estimate exists", () => {
    const metrics = getPlaytimeMetrics({
      playtimeMinutes: 45,
      estimatedHours: null,
      lastPlayed: null,
      backlogSlot: "short",
      completionType: "completable",
    });

    expect(metrics).toEqual({
      played: "45m",
      typicalFinish: "4.0h",
      remaining: "3.3h",
      progress: "19%",
      lastPlayed: "-",
      basis: "Category estimate",
    });
  });

  it("uses placeholders when no estimate can be derived", () => {
    const metrics = getPlaytimeMetrics({
      playtimeMinutes: 45,
      estimatedHours: null,
      lastPlayed: null,
    });

    expect(metrics).toEqual({
      played: "45m",
      typicalFinish: "-",
      remaining: "-",
      progress: "-",
      lastPlayed: "-",
      basis: "No estimate",
    });
  });

  it("derives remaining time and progress from the existing estimate", () => {
    const metrics = getPlaytimeMetrics({
      playtimeMinutes: 45,
      estimatedHours: 2,
      lastPlayed: new Date("2026-06-20T12:00:00Z"),
      backlogSlot: "short",
      completionType: "completable",
    });

    expect(metrics.played).toBe("45m");
    expect(metrics.typicalFinish).toBe("2.0h");
    expect(metrics.remaining).toBe("1.3h");
    expect(metrics.progress).toBe("38%");
    expect(metrics.lastPlayed).toBe("Jun 20, 2026");
    expect(metrics.basis).toBe("Saved estimate");
  });

  it("keeps progress uncapped once played time meets the estimate", () => {
    const metrics = getPlaytimeMetrics({
      playtimeMinutes: 150,
      estimatedHours: 2,
      lastPlayed: null,
      backlogSlot: "short",
      completionType: "completable",
    });

    expect(metrics.typicalFinish).toBe("2.0h");
    expect(metrics.remaining).toBe("At / over estimate");
    expect(metrics.progress).toBe("125%");
    expect(metrics.basis).toBe("Saved estimate");
  });

  it("treats open-ended completion types as ongoing instead of blank", () => {
    const metrics = getPlaytimeMetrics({
      playtimeMinutes: 600,
      estimatedHours: null,
      lastPlayed: null,
      backlogSlot: "parking_lot",
      completionType: "live_service",
    });

    expect(metrics.typicalFinish).toBe("Open-ended");
    expect(metrics.remaining).toBe("Ongoing");
    expect(metrics.progress).toBe("-");
    expect(metrics.basis).toBe("Open-ended type");
  });
});

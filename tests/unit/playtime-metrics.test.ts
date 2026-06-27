import { describe, expect, it } from "vitest";

import { getPlaytimeMetrics } from "@/lib/backlog/playtime-metrics";

describe("playtime metrics", () => {
  it("uses placeholders when no typical completion estimate exists", () => {
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
    });
  });

  it("derives remaining time and progress from the existing estimate", () => {
    const metrics = getPlaytimeMetrics({
      playtimeMinutes: 45,
      estimatedHours: 2,
      lastPlayed: new Date("2026-06-20T12:00:00Z"),
    });

    expect(metrics.played).toBe("45m");
    expect(metrics.typicalFinish).toBe("2.0h");
    expect(metrics.remaining).toBe("1.3h");
    expect(metrics.progress).toBe("38%");
    expect(metrics.lastPlayed).toBe("Jun 20, 2026");
  });

  it("keeps progress uncapped once played time meets the estimate", () => {
    const metrics = getPlaytimeMetrics({
      playtimeMinutes: 150,
      estimatedHours: 2,
      lastPlayed: null,
    });

    expect(metrics.typicalFinish).toBe("2.0h");
    expect(metrics.remaining).toBe("At / over estimate");
    expect(metrics.progress).toBe("125%");
  });
});

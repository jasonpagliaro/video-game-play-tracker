import { describe, expect, it } from "vitest";

import { inferBacklogSlot, inferCompletionType } from "@/lib/backlog/inference";

describe("deterministic game classification", () => {
  it("uses known-title overrides for open-ended examples", () => {
    expect(inferCompletionType({ title: "Arc Raiders" })).toBe("live_service");
    expect(inferCompletionType({ title: "Helldivers 2" })).toBe("live_service");
    expect(inferCompletionType({ title: "Stardew Valley" })).toBe("sandbox");
    expect(inferCompletionType({ title: "Valheim" })).toBe("sandbox");
    expect(inferCompletionType({ title: "Enshrouded" })).toBe("sandbox");
  });

  it("routes open-ended completion types to the parking lot slot", () => {
    const completionType = inferCompletionType({ title: "Stardew Valley" });

    expect(inferBacklogSlot({ title: "Stardew Valley", completionType, playtimeMinutes: 600 })).toBe("parking_lot");
  });

  it("detects representative live-service, endless, and roguelike metadata", () => {
    expect(inferCompletionType({ title: "Seasonal Shooter", tags: ["Battle Pass"] })).toBe("live_service");
    expect(inferCompletionType({ title: "Arcade Run", tags: ["Open-Ended"] })).toBe("endless");
    expect(inferCompletionType({ title: "Dice Crawler", genres: ["Roguelite"] })).toBe("roguelike");
  });
});

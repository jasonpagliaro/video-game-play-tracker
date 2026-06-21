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

  it("uses the open-ended slot only when no specific category is available", () => {
    const completionType = inferCompletionType({ title: "Stardew Valley" });

    expect(inferBacklogSlot({ title: "Stardew Valley", completionType, playtimeMinutes: 600 })).toBe("parking_lot");
  });

  it("keeps open-ended finish styles while assigning specific backlog categories from metadata", () => {
    const completionType = inferCompletionType({
      title: "Stardew Valley",
      genres: ["RPG", "Simulation"],
      tags: ["Online Co-op"],
    });

    expect(completionType).toBe("sandbox");
    expect(
      inferBacklogSlot({
        title: "Stardew Valley",
        genres: ["RPG", "Simulation"],
        tags: ["Online Co-op"],
        completionType,
        playtimeMinutes: 600,
      }),
    ).toBe("rpg_long");
  });

  it("detects representative live-service, endless, and roguelike metadata", () => {
    expect(inferCompletionType({ title: "Seasonal Shooter", tags: ["Battle Pass"] })).toBe("live_service");
    expect(inferCompletionType({ title: "Arcade Run", tags: ["Open-Ended"] })).toBe("endless");
    expect(inferCompletionType({ title: "Dice Crawler", genres: ["Roguelite"] })).toBe("roguelike");
  });

  it("recognizes broader Steam metadata terms as concrete categories", () => {
    expect(inferBacklogSlot({ title: "Neon Kart", genres: ["Racing"], playtimeMinutes: 0 })).toBe("action");
    expect(inferBacklogSlot({ title: "Tower Tactics", tags: ["Deckbuilder"], playtimeMinutes: 0 })).toBe("strategy");
    expect(inferBacklogSlot({ title: "Local Crew", tags: ["Online Co-op"], playtimeMinutes: 0 })).toBe("coop");
  });
});

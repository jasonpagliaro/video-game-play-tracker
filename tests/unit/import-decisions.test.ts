import { describe, expect, it } from "vitest";

import {
  buildReclassificationPatch,
  resolveSyncedClassification,
  statusForImportDecision,
} from "@/lib/db/repository";

describe("import decisions", () => {
  it("parks open-ended imports by default while allowing explicit queue override", () => {
    const openEnded = { completionType: "sandbox" as const, backlogSlot: "parking_lot" as const };

    expect(statusForImportDecision("unqueued", openEnded)).toBe("parked");
    expect(statusForImportDecision("review", openEnded)).toBe("parked");
    expect(statusForImportDecision("queue", openEnded)).toBe("not_started");
  });

  it("parks open-ended imports by default even when they have a concrete backlog category", () => {
    const openEndedAction = { completionType: "live_service" as const, backlogSlot: "action" as const };

    expect(statusForImportDecision("unqueued", openEndedAction)).toBe("parked");
    expect(statusForImportDecision("review", openEndedAction)).toBe("parked");
    expect(statusForImportDecision("queue", openEndedAction)).toBe("not_started");
  });

  it("keeps completable imports unqueued by default", () => {
    expect(statusForImportDecision("unqueued", { completionType: "completable", backlogSlot: "action" })).toBe(
      "not_started",
    );
  });

  it("preserves manual category overrides during sync", () => {
    expect(
      resolveSyncedClassification(
        {
          backlogSlot: "action",
          completionType: "completable",
          manualBacklogSlot: true,
          manualCompletionType: true,
        },
        { backlogSlot: "parking_lot", completionType: "sandbox" },
      ),
    ).toEqual({ backlogSlot: "action", completionType: "completable" });
  });

  it("updates non-manual categories from incoming deterministic inference", () => {
    expect(
      resolveSyncedClassification(
        {
          backlogSlot: "experimental",
          completionType: "unknown",
          manualBacklogSlot: false,
          manualCompletionType: false,
        },
        { backlogSlot: "parking_lot", completionType: "live_service" },
      ),
    ).toEqual({ backlogSlot: "parking_lot", completionType: "live_service" });
  });

  it("preserves manual category/type overrides during reclassification", () => {
    const patch = buildReclassificationPatch(
      {
        title: "Manual Sandbox",
        genres: null,
        tags: null,
        playtimeMinutes: 600,
        personalInterest: "high",
        estimatedHours: null,
        steamReviewScore: null,
        backlogSlot: "action",
        completionType: "completable",
        manualBacklogSlot: true,
        manualCompletionType: true,
        rawImportMetadata: null,
      } as Parameters<typeof buildReclassificationPatch>[0],
      {
        genres: ["Simulation"],
        tags: ["Online Co-op"],
        releaseYear: 2016,
        steamReviewScore: 89,
        raw: { steam_appid: 413150 },
      },
    );

    expect(patch.backlogSlot).toBe("action");
    expect(patch.completionType).toBe("completable");
    expect(patch.genres).toEqual(["Simulation"]);
    expect(patch.tags).toEqual(["Online Co-op"]);
    expect(patch.releaseYear).toBe(2016);
    expect(patch.steamReviewScore).toBe(89);
    expect(patch.rawImportMetadata).toEqual({ store: { steam_appid: 413150 } });
  });
});

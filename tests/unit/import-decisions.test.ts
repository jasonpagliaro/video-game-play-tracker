import { describe, expect, it } from "vitest";

import {
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
});

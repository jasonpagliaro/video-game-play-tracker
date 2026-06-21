import { describe, expect, it } from "vitest";

import {
  gameIsVisibleInTable,
  getGameDestination,
  parseOptionalPositiveInteger,
  parsePositiveInteger,
  type GameVisibilitySnapshot,
} from "@/lib/backlog/autosave";

function game(overrides: Partial<GameVisibilitySnapshot> = {}): GameVisibilitySnapshot {
  return {
    id: "game-1",
    title: "Game 1",
    status: "not_started",
    currentRotation: false,
    queueRank: null,
    backlogSlot: "action",
    completionType: "completable",
    syncState: "synced",
    playtimeMinutes: 0,
    detailHref: "/games/game-1",
    ...overrides,
  };
}

const allFilters = {
  statusFilter: "all",
  slotFilter: "all",
  typeFilter: "all",
};

describe("auto-save parsing", () => {
  it("parses required and optional positive integer settings", () => {
    expect(parsePositiveInteger("5", "Max active rotation", 1)).toEqual({ ok: true, value: 5 });
    expect(parsePositiveInteger("", "Max active rotation", 1).ok).toBe(false);
    expect(parseOptionalPositiveInteger("", "Max installed warning count", 1)).toEqual({ ok: true, value: null });
    expect(parseOptionalPositiveInteger("2", "Max installed warning count", 1)).toEqual({ ok: true, value: 2 });
  });
});

describe("auto-save table visibility", () => {
  it("matches backlog rows unless filters exclude them", () => {
    expect(gameIsVisibleInTable(game(), "all", allFilters)).toBe(true);
    expect(
      gameIsVisibleInTable(game({ status: "completed" }), "all", {
        ...allFilters,
        statusFilter: "not_started",
      }),
    ).toBe(false);
  });

  it("detects queue membership", () => {
    expect(gameIsVisibleInTable(game({ queueRank: 1000 }), "queue", allFilters)).toBe(true);
    expect(gameIsVisibleInTable(game({ queueRank: null }), "queue", allFilters)).toBe(false);
  });

  it("detects active rotation membership", () => {
    expect(gameIsVisibleInTable(game({ currentRotation: true }), "rotation_active", allFilters)).toBe(true);
    expect(gameIsVisibleInTable(game({ currentRotation: false }), "rotation_active", allFilters)).toBe(false);
    expect(gameIsVisibleInTable(game({ currentRotation: false }), "rotation_all", allFilters)).toBe(true);
  });

  it("detects completed and dnf memberships", () => {
    expect(gameIsVisibleInTable(game({ status: "completed" }), "completed", allFilters)).toBe(true);
    expect(gameIsVisibleInTable(game({ status: "done_for_now" }), "completed", allFilters)).toBe(true);
    expect(gameIsVisibleInTable(game({ status: "dnf" }), "dnf", allFilters)).toBe(true);
    expect(gameIsVisibleInTable(game({ status: "wont_complete" }), "dnf", allFilters)).toBe(true);
    expect(gameIsVisibleInTable(game({ status: "parked" }), "dnf", allFilters)).toBe(false);
  });

  it("detects parking sections", () => {
    const parkedSandbox = game({
      status: "parked",
      completionType: "sandbox",
      playtimeMinutes: 240,
      queueRank: null,
    });
    expect(gameIsVisibleInTable(parkedSandbox, "parking_all", allFilters)).toBe(true);
    expect(gameIsVisibleInTable(parkedSandbox, "parking_done_for_now_candidate", allFilters)).toBe(true);
    expect(gameIsVisibleInTable(parkedSandbox, "parking_remaining", allFilters)).toBe(false);
    expect(gameIsVisibleInTable(parkedSandbox, "ongoing_done_for_now_candidate", allFilters)).toBe(true);
    expect(gameIsVisibleInTable(parkedSandbox, "ongoing_open_ended", allFilters)).toBe(false);
    expect(gameIsVisibleInTable(game({ status: "done_for_now", completionType: "sandbox" }), "parking_all", allFilters)).toBe(false);
    expect(gameIsVisibleInTable(game({ status: "parked" }), "ongoing_parked", allFilters)).toBe(true);
  });
});

describe("auto-save destinations", () => {
  it("prefers the most specific destination for moved games", () => {
    expect(getGameDestination(game({ currentRotation: true }))).toEqual({ href: "/rotation", label: "Rotation" });
    expect(getGameDestination(game({ queueRank: 1000 }))).toEqual({ href: "/queue", label: "Next Up" });
    expect(getGameDestination(game({ status: "completed" }))).toEqual({ href: "/completed", label: "Completed" });
    expect(getGameDestination(game({ status: "wont_complete" }))).toEqual({ href: "/dnf", label: "DNF / Won't" });
    expect(getGameDestination(game({ status: "parked" }))).toEqual({ href: "/ongoing", label: "Ongoing" });
    expect(getGameDestination(game())).toEqual({ href: "/backlog", label: "Backlog" });
  });
});

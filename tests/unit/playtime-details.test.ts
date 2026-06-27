// @vitest-environment jsdom
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DashboardPlaytimeDetails,
  DashboardPlaytimeDetailsProvider,
} from "@/components/dashboard/playtime-details";
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

describe("DashboardPlaytimeDetails", () => {
  it("expands and collapses all playtime details from any toggle", () => {
    render(
      createElement(
        DashboardPlaytimeDetailsProvider,
        null,
        createElement(
          "div",
          null,
          createElement(DashboardPlaytimeDetails, { game: baseGame }),
          createElement(DashboardPlaytimeDetails, {
            game: { ...baseGame, playtimeMinutes: 150, estimatedHours: 4 },
          }),
        ),
      ),
    );

    const closedButtons = screen.getAllByRole("button", { name: "Show play time details" });
    expect(closedButtons).toHaveLength(2);
    expect(closedButtons.every((button) => button.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(screen.queryAllByText("Played")).toHaveLength(0);

    fireEvent.click(closedButtons[0]!);

    const openButtons = screen.getAllByRole("button", { name: "Hide play time details" });
    expect(openButtons).toHaveLength(2);
    expect(openButtons.every((button) => button.getAttribute("aria-expanded") === "true")).toBe(true);
    expect(screen.getAllByText("Played")).toHaveLength(2);

    fireEvent.click(openButtons[1]!);

    const closedAgainButtons = screen.getAllByRole("button", { name: "Show play time details" });
    expect(closedAgainButtons).toHaveLength(2);
    expect(closedAgainButtons.every((button) => button.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(screen.queryAllByText("Played")).toHaveLength(0);
  });
});

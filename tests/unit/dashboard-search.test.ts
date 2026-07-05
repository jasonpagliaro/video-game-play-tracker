import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DashboardGameSearch } from "@/components/dashboard/dashboard-game-search";
import { searchDashboardGames, type DashboardSearchItem } from "@/lib/backlog/dashboard-search";

function game(overrides: Partial<DashboardSearchItem> = {}): DashboardSearchItem {
  const id = overrides.id ?? "game";
  return {
    id,
    title: overrides.title ?? id,
    steamAppId: overrides.steamAppId ?? null,
    status: overrides.status ?? "not_started",
    backlogSlot: overrides.backlogSlot ?? "action",
    completionType: overrides.completionType ?? "completable",
    currentRotation: overrides.currentRotation ?? false,
    queuePosition: overrides.queuePosition ?? null,
  };
}

describe("dashboard game search", () => {
  it("returns no games for an empty query", () => {
    expect(searchDashboardGames([game({ title: "A Short Hike" })], "")).toEqual([]);
    expect(searchDashboardGames([game({ title: "A Short Hike" })], "   ")).toEqual([]);
  });

  it("matches title terms case-insensitively", () => {
    const results = searchDashboardGames(
      [game({ id: "short-hike", title: "A Short Hike" }), game({ id: "hades", title: "Hades" })],
      "short",
    );

    expect(results.map((result) => result.id)).toEqual(["short-hike"]);
  });

  it("matches titles when punctuation is omitted", () => {
    const results = searchDashboardGames(
      [game({ id: "ten-million", title: "10,000,000" }), game({ id: "one-million", title: "1000000" })],
      "10000000",
    );

    expect(results.map((result) => result.id)).toEqual(["ten-million"]);
  });

  it("matches by Steam app ID", () => {
    const results = searchDashboardGames(
      [game({ id: "steam", title: "Portal 2", steamAppId: 620 }), game({ id: "other", title: "Portal" })],
      "620",
    );

    expect(results.map((result) => result.id)).toEqual(["steam"]);
  });

  it("requires every query term to match title or Steam app ID", () => {
    const results = searchDashboardGames(
      [
        game({ id: "exact", title: "Elden Ring", steamAppId: 1245620 }),
        game({ id: "partial", title: "Elden" }),
        game({ id: "other", title: "Ring Fit Adventure" }),
      ],
      "elden ring",
    );

    expect(results.map((result) => result.id)).toEqual(["exact"]);
  });

  it("orders exact and prefix title matches before substring and Steam app ID matches", () => {
    const results = searchDashboardGames(
      [
        game({ id: "id-match", title: "Unrelated", steamAppId: 620 }),
        game({ id: "substring", title: "The 620 Collection" }),
        game({ id: "exact", title: "620" }),
        game({ id: "prefix", title: "620 Games" }),
      ],
      "620",
    );

    expect(results.map((result) => result.id)).toEqual(["exact", "prefix", "substring", "id-match"]);
  });

  it("favors active games and then queued games when rank is otherwise tied", () => {
    const results = searchDashboardGames(
      [
        game({ id: "plain", title: "Control" }),
        game({ id: "queued", title: "Control", queuePosition: 3 }),
        game({ id: "active", title: "Control", currentRotation: true }),
        game({ id: "queued-first", title: "Control", queuePosition: 1 }),
      ],
      "control",
    );

    expect(results.map((result) => result.id)).toEqual(["active", "queued-first", "queued", "plain"]);
  });

  it("limits result count", () => {
    const results = searchDashboardGames(
      [
        game({ id: "one", title: "Game One" }),
        game({ id: "two", title: "Game Two" }),
        game({ id: "three", title: "Game Three" }),
      ],
      "game",
      { limit: 2 },
    );

    expect(results).toHaveLength(2);
  });

  it("renders the search shell without initial results", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardGameSearch, {
        games: [game({ id: "short-hike", title: "A Short Hike", steamAppId: 1055540 })],
      }),
    );

    expect(html).toContain('data-dashboard-game-search="finder"');
    expect(html).toContain("Find game");
    expect(html).toContain("1 game indexed");
    expect(html).toContain("Search games or Steam App ID");
    expect(html).not.toContain("A Short Hike");
  });
});

import { describe, expect, it } from "vitest";

import { parseSteamCsv } from "@/lib/backlog/csv";
import { normalizeTitle } from "@/lib/backlog/normalize";

describe("Steam CSV parsing", () => {
  it("maps the known exported CSV columns", () => {
    const preview = parseSteamCsv(
      "\uFEFFgame,id,hours,last_played,steam_deck,metascore,userscore,wilsonscore,sdbrating,userscore_count,release_date\n" +
        '"10,000,000",227580,0.16666666666666666,,playable,67,90,89,86,1798,2013-01-15\n',
      "steam-library.csv",
    );

    expect(preview.rowCount).toBe(1);
    expect(preview.validCount).toBe(1);
    expect(preview.mapping.title).toBe("game");
    expect(preview.mapping.steamAppId).toBe("id");
    expect(preview.mapping.playtimeHours).toBe("hours");
    expect(preview.rows[0]?.normalized?.title).toBe("10,000,000");
    expect(preview.rows[0]?.normalized?.steamAppId).toBe(227580);
    expect(preview.rows[0]?.normalized?.playtimeMinutes).toBe(10);
    expect(preview.rows[0]?.normalized?.releaseYear).toBe(2013);
  });

  it("reports invalid rows without crashing", () => {
    const preview = parseSteamCsv("game,id,hours\n,123,1\nValid Game,456,2\n");
    expect(preview.validCount).toBe(1);
    expect(preview.skippedCount).toBe(1);
    expect(preview.rows[0]?.valid).toBe(false);
  });
});

describe("title normalization", () => {
  it("removes punctuation, trademarks, case, and accents", () => {
    expect(normalizeTitle("A Game About Digging A Hole™")).toBe("a game about digging a hole");
    expect(normalizeTitle("Café & Combat®")).toBe("cafe and combat");
  });
});


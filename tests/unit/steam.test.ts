import { describe, expect, it } from "vitest";

import { parseSteamIdentifier } from "@/lib/steam/identifier";
import { buildSteamLibraryPreview, normalizeSteamOwnedGame } from "@/lib/steam/library";

const steamid64 = "76561197960287930";

describe("Steam identifier parsing", () => {
  it("accepts a SteamID64", () => {
    expect(parseSteamIdentifier(steamid64)).toEqual({
      kind: "steamid64",
      steamid64,
      original: steamid64,
    });
  });

  it("accepts profile URLs", () => {
    expect(parseSteamIdentifier(`https://steamcommunity.com/profiles/${steamid64}/`)).toMatchObject({
      kind: "steamid64",
      steamid64,
    });
  });

  it("accepts vanity URLs and raw vanity names", () => {
    expect(parseSteamIdentifier("https://steamcommunity.com/id/example_user/")).toMatchObject({
      kind: "vanity",
      vanity: "example_user",
    });
    expect(parseSteamIdentifier("example-user")).toMatchObject({
      kind: "vanity",
      vanity: "example-user",
    });
  });

  it("converts SteamID2 and SteamID3 to SteamID64", () => {
    expect(parseSteamIdentifier("STEAM_1:0:11101")).toMatchObject({
      kind: "steamid64",
      steamid64,
    });
    expect(parseSteamIdentifier("[U:1:22202]")).toMatchObject({
      kind: "steamid64",
      steamid64,
    });
  });

  it("rejects non-profile Steam URLs", () => {
    expect(() => parseSteamIdentifier("https://store.steampowered.com/app/220/HalfLife_2/")).toThrow(
      "Only steamcommunity.com profile URLs are supported.",
    );
    expect(() => parseSteamIdentifier("https://steamcommunity.com/groups/example")).toThrow(
      "Only individual Steam profile URLs are supported.",
    );
  });
});

describe("Steam library normalization", () => {
  it("normalizes owned-game payloads", () => {
    const result = normalizeSteamOwnedGame(
      {
        appid: 220,
        name: "Half-Life 2",
        playtime_forever: 123,
        playtime_windows_forever: 120,
        playtime_mac_forever: 2,
        playtime_linux_forever: 1,
        rtime_last_played: 1_700_000_000,
      },
      steamid64,
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.normalized.steamAppId).toBe(220);
    expect(result.normalized.title).toBe("Half-Life 2");
    expect(result.normalized.playtimeMinutes).toBe(123);
    expect(result.normalized.playtimeWindowsMinutes).toBe(120);
    expect(result.normalized.lastPlayed?.toISOString()).toBe("2023-11-14T22:13:20.000Z");
    expect(result.normalized.rawImportMetadata.source).toBe("steam_library");
  });

  it("builds previews without treating empty libraries as missing-safe updates", () => {
    const preview = buildSteamLibraryPreview({
      identifier: steamid64,
      account: {
        steamid64,
        displayName: "Test User",
        customProfileId: null,
        profileUrl: `https://steamcommunity.com/profiles/${steamid64}/`,
      },
      games: [],
    });

    expect(preview.privateOrEmpty).toBe(true);
    expect(preview.validCount).toBe(0);
    expect(preview.skippedCount).toBe(0);
    expect(preview.rows).toEqual([]);
  });

  it("skips malformed owned-game rows without crashing", () => {
    const preview = buildSteamLibraryPreview({
      identifier: steamid64,
      account: {
        steamid64,
        displayName: "Test User",
        customProfileId: null,
        profileUrl: null,
      },
      games: [{ appid: 10, name: "Valid Game" }, { appid: 20 }],
    });

    expect(preview.rowCount).toBe(2);
    expect(preview.validCount).toBe(1);
    expect(preview.skippedCount).toBe(1);
    expect(preview.rows[1]?.valid).toBe(false);
  });
});

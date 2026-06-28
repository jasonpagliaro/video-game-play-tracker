import { afterEach, describe, expect, it, vi } from "vitest";

import { parseSteamIdentifier } from "@/lib/steam/identifier";
import { buildSteamLibraryPreview, normalizeSteamOwnedGame } from "@/lib/steam/library";
import { fetchSteamStoreMetadataForAppIds } from "@/lib/steam/client";
import { normalizeSteamStoreAppMetadata } from "@/lib/steam/metadata";

const steamid64 = "76561197960287930";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("auto-sorts known open-ended Steam library titles", () => {
    const result = normalizeSteamOwnedGame(
      {
        appid: 553850,
        name: "Helldivers 2",
        playtime_forever: 360,
      },
      steamid64,
    );

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.normalized.completionType).toBe("live_service");
    expect(result.normalized.backlogSlot).toBe("parking_lot");
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
    expect(preview.metadataEnrichedCount).toBe(0);
    expect(preview.metadataFailedCount).toBe(0);
    expect(preview.deckPlayabilityEnrichedCount).toBe(0);
    expect(preview.deckPlayabilityFailedCount).toBe(0);
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

  it("enriches owned games with Steam Store metadata", () => {
    const metadata = normalizeSteamStoreAppMetadata({
      genres: [{ description: "Action" }],
      categories: [{ description: "Single-player" }],
      release_date: { coming_soon: false, date: "Nov 16, 2004" },
      metacritic: { score: 96 },
    });
    expect(metadata).not.toBeNull();

    const preview = buildSteamLibraryPreview({
      identifier: steamid64,
      account: {
        steamid64,
        displayName: "Test User",
        customProfileId: null,
        profileUrl: null,
      },
      games: [{ appid: 220, name: "Half-Life 2", playtime_forever: 123 }],
      storeMetadataByAppId: new Map([[220, metadata!]]),
    });

    expect(preview.metadataEnrichedCount).toBe(1);
    expect(preview.metadataFailedCount).toBe(0);
    expect(preview.rows[0]?.normalized?.genres).toEqual(["Action"]);
    expect(preview.rows[0]?.normalized?.tags).toEqual(["Single-player"]);
    expect(preview.rows[0]?.normalized?.releaseYear).toBe(2004);
    expect(preview.rows[0]?.normalized?.steamReviewScore).toBe(96);
    expect(preview.rows[0]?.normalized?.backlogSlot).toBe("action");
    expect(preview.rows[0]?.normalized?.rawImportMetadata.store).toMatchObject({
      release_date: { date: "Nov 16, 2004" },
    });
  });

  it("keeps owned-game normalization valid when Store metadata fails", () => {
    const preview = buildSteamLibraryPreview({
      identifier: steamid64,
      account: {
        steamid64,
        displayName: "Test User",
        customProfileId: null,
        profileUrl: null,
      },
      games: [{ appid: 10, name: "Valid Game", playtime_forever: 0 }],
      metadataFailedAppIds: new Set([10]),
    });

    expect(preview.validCount).toBe(1);
    expect(preview.metadataEnrichedCount).toBe(0);
    expect(preview.metadataFailedCount).toBe(1);
    expect(preview.rows[0]?.normalized?.title).toBe("Valid Game");
  });

  it("enriches owned games with Steam Deck playability metadata", () => {
    const updatedAt = new Date("2026-06-27T00:00:00Z");
    const preview = buildSteamLibraryPreview({
      identifier: steamid64,
      account: {
        steamid64,
        displayName: "Test User",
        customProfileId: null,
        profileUrl: null,
      },
      games: [{ appid: 227580, name: "10,000,000", playtime_forever: 10 }],
      deckPlayabilityByAppId: new Map([
        [
          227580,
          {
            steamDeckCompatibilityCategory: "playable",
            steamDeckCompatibilityItems: [
              {
                status: "warning",
                label: "Native resolution is not the default",
                locToken: "#SteamDeckVerified_TestResult_NativeResolutionNotDefault",
                rawDisplayType: 3,
              },
            ],
            protondbTier: "platinum",
            protondbConfidence: "low",
            protondbScore: 0.51,
            protondbReportCount: 6,
            deckPlayabilityUpdatedAt: updatedAt,
            deckPlayabilityRaw: { steam: { resolved_category: 2 }, protondb: { tier: "platinum" } },
          },
        ],
      ]),
    });

    expect(preview.deckPlayabilityEnrichedCount).toBe(1);
    expect(preview.deckPlayabilityFailedCount).toBe(0);
    expect(preview.rows[0]?.normalized?.steamDeckCompatibilityCategory).toBe("playable");
    expect(preview.rows[0]?.normalized?.steamDeckCompatibilityItems?.[0]?.status).toBe("warning");
    expect(preview.rows[0]?.normalized?.protondbTier).toBe("platinum");
    expect(preview.rows[0]?.normalized?.deckPlayabilityUpdatedAt).toBe(updatedAt);
    expect(preview.rows[0]?.normalized?.rawImportMetadata.deck_playability).toEqual({
      steam: { resolved_category: 2 },
      protondb: { tier: "platinum" },
    });
  });
});

describe("Steam Store metadata", () => {
  it("normalizes Store appdetails metadata", () => {
    expect(
      normalizeSteamStoreAppMetadata({
        genres: [{ description: "RPG" }, { description: "Simulation" }],
        categories: [{ description: "Online Co-op" }],
        release_date: { coming_soon: false, date: "Feb 26, 2016" },
        metacritic: { score: 89 },
      }),
    ).toMatchObject({
      genres: ["RPG", "Simulation"],
      tags: ["Online Co-op"],
      releaseYear: 2016,
      steamReviewScore: 89,
    });
  });

  it("treats Store fetch failures as per-app metadata misses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limited", { status: 429 })),
    );

    const result = await fetchSteamStoreMetadataForAppIds([220, 413150]);

    expect(result.metadataByAppId.size).toBe(0);
    expect([...result.failedAppIds].sort((a, b) => a - b)).toEqual([220, 413150]);
  });
});

import { describe, expect, it } from "vitest";

import {
  getSteamSyncIntervalHours,
  isSteamRefreshDue,
  validateSteamSyncInterval,
} from "@/lib/steam/auto-refresh";

const now = new Date("2026-06-22T12:00:00.000Z");

describe("Steam auto-refresh cadence", () => {
  it("converts days and hours into an hourly interval", () => {
    expect(getSteamSyncIntervalHours({ steamSyncIntervalDays: 1, steamSyncIntervalHours: 6 })).toBe(30);
    expect(getSteamSyncIntervalHours({ steamSyncIntervalDays: 0, steamSyncIntervalHours: 6 })).toBe(6);
  });

  it("validates the days plus hours interval", () => {
    expect(validateSteamSyncInterval(1, 0)).toBeNull();
    expect(validateSteamSyncInterval(0, 6)).toBeNull();
    expect(validateSteamSyncInterval(0, 0)).toMatch(/at least 1 hour/i);
    expect(validateSteamSyncInterval(-1, 0)).toMatch(/days/i);
    expect(validateSteamSyncInterval(0, 24)).toMatch(/hours/i);
  });

  it("only schedules enabled accounts with a SteamID64", () => {
    expect(
      isSteamRefreshDue(
        {
          steamAutoSyncEnabled: false,
          steamSyncIntervalDays: 0,
          steamSyncIntervalHours: 6,
          steamid64: "76561197960287930",
          lastLibrarySyncAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isSteamRefreshDue(
        {
          steamAutoSyncEnabled: true,
          steamSyncIntervalDays: 0,
          steamSyncIntervalHours: 6,
          steamid64: null,
          lastLibrarySyncAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("treats never-synced and expired accounts as due", () => {
    expect(
      isSteamRefreshDue(
        {
          steamAutoSyncEnabled: true,
          steamSyncIntervalDays: 1,
          steamSyncIntervalHours: 0,
          steamid64: "76561197960287930",
          lastLibrarySyncAt: null,
        },
        now,
      ),
    ).toBe(true);
    expect(
      isSteamRefreshDue(
        {
          steamAutoSyncEnabled: true,
          steamSyncIntervalDays: 0,
          steamSyncIntervalHours: 6,
          steamid64: "76561197960287930",
          lastLibrarySyncAt: "2026-06-22T06:00:00.000Z",
        },
        now,
      ),
    ).toBe(true);
  });

  it("does not refresh accounts before the interval expires", () => {
    expect(
      isSteamRefreshDue(
        {
          steamAutoSyncEnabled: true,
          steamSyncIntervalDays: 0,
          steamSyncIntervalHours: 6,
          steamid64: "76561197960287930",
          lastLibrarySyncAt: "2026-06-22T07:00:00.000Z",
        },
        now,
      ),
    ).toBe(false);
  });
});

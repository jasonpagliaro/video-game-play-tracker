import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runScheduledSteamRefreshMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/steam/scheduler", () => ({
  runScheduledSteamRefresh: runScheduledSteamRefreshMock,
}));

import { GET } from "@/app/api/cron/steam-refresh/route";

describe("Steam refresh cron route", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    runScheduledSteamRefreshMock.mockResolvedValue({
      ok: true,
      checkedCount: 1,
      dueCount: 1,
      refreshedCount: 1,
      failedCount: 0,
      skippedReason: null,
      results: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("rejects requests without the cron secret", async () => {
    const response = await GET(new Request("https://example.com/api/cron/steam-refresh"));

    expect(response.status).toBe(401);
    expect(runScheduledSteamRefreshMock).not.toHaveBeenCalled();
  });

  it("runs the scheduler when authorized", async () => {
    const response = await GET(
      new Request("https://example.com/api/cron/steam-refresh", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.refreshedCount).toBe(1);
    expect(runScheduledSteamRefreshMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(
      new Request("https://example.com/api/cron/steam-refresh", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(401);
    expect(runScheduledSteamRefreshMock).not.toHaveBeenCalled();
  });
});

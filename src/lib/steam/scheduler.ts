import {
  applySteamLibraryImport,
  getDueSteamAutoRefreshAccounts,
  recordSteamAutoRefreshFailure,
  type DueSteamAutoRefreshAccount,
} from "@/lib/db/repository";
import { isDatabaseConfigured, getSteamApiKey } from "@/lib/env";
import { fetchSteamLibraryPreview } from "@/lib/steam/client";

export type ScheduledSteamRefreshItem = {
  steamAccountId: string;
  steamid64: string;
  displayName: string | null;
  ok: boolean;
  addedCount?: number;
  updatedCount?: number;
  missingCount?: number;
  queuedCount?: number;
  error?: string;
};

export type ScheduledSteamRefreshResult = {
  ok: boolean;
  checkedCount: number;
  dueCount: number;
  refreshedCount: number;
  failedCount: number;
  skippedReason: string | null;
  results: ScheduledSteamRefreshItem[];
};

export async function runScheduledSteamRefresh({
  now = new Date(),
  limit = 5,
}: {
  now?: Date;
  limit?: number;
} = {}): Promise<ScheduledSteamRefreshResult> {
  if (!isDatabaseConfigured()) return emptyResult("DATABASE_URL is not configured.");
  if (!getSteamApiKey()) return emptyResult("STEAM_API_KEY is not configured.");

  const { checkedCount, dueAccounts } = await getDueSteamAutoRefreshAccounts({ now, limit });
  const results: ScheduledSteamRefreshItem[] = [];

  for (const account of dueAccounts) {
    results.push(await refreshOneAccount(account));
  }

  const failedCount = results.filter((result) => !result.ok).length;
  return {
    ok: failedCount === 0,
    checkedCount,
    dueCount: dueAccounts.length,
    refreshedCount: results.length - failedCount,
    failedCount,
    skippedReason: null,
    results,
  };
}

async function refreshOneAccount(account: DueSteamAutoRefreshAccount): Promise<ScheduledSteamRefreshItem> {
  try {
    const library = await fetchSteamLibraryPreview(account.steamid64, { sampleLimit: 0 });
    const result = await applySteamLibraryImport({
      user: account.user,
      library,
      decision: account.autoQueueNewImports ? "queue" : "review",
    });

    return {
      steamAccountId: account.steamAccountId,
      steamid64: account.steamid64,
      displayName: account.displayName,
      ok: true,
      addedCount: result.addedCount,
      updatedCount: result.updatedCount,
      missingCount: result.missingCount,
      queuedCount: result.queuedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Steam refresh failed.";
    await recordSteamAutoRefreshFailure({
      user: account.user,
      steamAccountId: account.steamAccountId,
      errorMessage: message,
    });

    return {
      steamAccountId: account.steamAccountId,
      steamid64: account.steamid64,
      displayName: account.displayName,
      ok: false,
      error: message,
    };
  }
}

function emptyResult(skippedReason: string): ScheduledSteamRefreshResult {
  return {
    ok: false,
    checkedCount: 0,
    dueCount: 0,
    refreshedCount: 0,
    failedCount: 0,
    skippedReason,
    results: [],
  };
}

export type SteamAutoRefreshSettings = {
  steamAutoSyncEnabled: boolean;
  steamSyncIntervalDays: number;
  steamSyncIntervalHours: number;
};

export type SteamRefreshDueInput = SteamAutoRefreshSettings & {
  steamid64: string | null;
  lastLibrarySyncAt: Date | string | null;
};

export function getSteamSyncIntervalHours(settings: Pick<SteamAutoRefreshSettings, "steamSyncIntervalDays" | "steamSyncIntervalHours">) {
  return settings.steamSyncIntervalDays * 24 + settings.steamSyncIntervalHours;
}

export function validateSteamSyncInterval(days: number, hours: number) {
  if (!Number.isInteger(days) || days < 0) return "Steam refresh interval days must be a whole number at least 0.";
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) {
    return "Steam refresh interval hours must be a whole number from 0 to 23.";
  }
  if (days === 0 && hours === 0) return "Steam refresh interval must be at least 1 hour.";
  return null;
}

export function isSteamRefreshDue(input: SteamRefreshDueInput, now: Date) {
  if (!input.steamAutoSyncEnabled || !input.steamid64) return false;
  const intervalHours = getSteamSyncIntervalHours(input);
  if (intervalHours < 1) return false;
  if (!input.lastLibrarySyncAt) return true;

  const lastSync = typeof input.lastLibrarySyncAt === "string" ? new Date(input.lastLibrarySyncAt) : input.lastLibrarySyncAt;
  const lastSyncMs = lastSync.getTime();
  if (Number.isNaN(lastSyncMs)) return true;

  return now.getTime() - lastSyncMs >= intervalHours * 60 * 60 * 1000;
}

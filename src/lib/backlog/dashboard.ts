import { isQueueEligible } from "@/lib/backlog/queue";
import { isDoneForNowCandidate } from "@/lib/backlog/status";
import { summarizeWarnings } from "@/lib/backlog/warnings";
import type { AppSettings, GameSummary, Warning } from "@/lib/backlog/types";

export type DashboardSummary = {
  activeGames: GameSummary[];
  queuedGames: GameSummary[];
  nextWindowGames: GameSummary[];
  warnings: Warning[];
  active: {
    openSlots: number;
    recentlyPlayedCount: number;
    staleCount: number;
    totalPlaytimeMinutes: number;
    achievementTrackedCount: number;
    achievementCoveragePercent: number | null;
    achievementAveragePercent: number | null;
    primaryWarning: Warning | null;
  };
  counts: {
    totalGames: number;
    active: number;
    installed: number;
    completed: number;
    doneForNow: number;
    dnf: number;
    parked: number;
    doneForNowCandidates: number;
    steamIdentified: number;
    totalPlaytimeMinutes: number;
  };
  queue: {
    total: number;
    windowSize: number;
    nextWindowCount: number;
    eligibleUnqueued: number;
    importedReview: number;
    warningCount: number;
  };
};

export function getDashboardSummary(
  games: GameSummary[],
  settings: AppSettings,
  options: { now?: Date } = {},
): DashboardSummary {
  const activeGames = games.filter((game) => game.currentRotation).sort(compareByTitle);
  const queuedGames = games
    .filter((game) => game.queueRank != null && isQueueEligible(game))
    .sort((a, b) => (a.queueRank ?? Number.MAX_SAFE_INTEGER) - (b.queueRank ?? Number.MAX_SAFE_INTEGER));
  const warnings = summarizeWarnings(games, settings);
  const windowSize = Math.max(1, settings.queueSlidingWindowSize);
  const queueEligibleUnqueued = games.filter((game) => game.queueRank == null && isQueueEligible(game));
  const activeWarning =
    warnings.find((warning) => warning.code.includes("active") || warning.code.includes("rotation")) ?? null;
  const nowMs = options.now?.getTime() ?? Date.now();
  const checkinWindowMs = Math.max(1, settings.checkinIntervalDays) * 24 * 60 * 60 * 1000;
  const recentCutoffMs = nowMs - checkinWindowMs;
  const activeLastPlayedTimes = activeGames.map((game) => getDateTime(game.lastPlayed));
  const activeAchievementValues = activeGames
    .map((game) => game.achievementPercent)
    .filter((value): value is number => value != null);

  return {
    activeGames,
    queuedGames,
    nextWindowGames: queuedGames.slice(0, windowSize),
    warnings,
    active: {
      openSlots: Math.max(0, settings.maxActiveRotationCount - activeGames.length),
      recentlyPlayedCount: activeLastPlayedTimes.filter((time) => time != null && time >= recentCutoffMs).length,
      staleCount: activeLastPlayedTimes.filter((time) => time == null || time < recentCutoffMs).length,
      totalPlaytimeMinutes: activeGames.reduce((sum, game) => sum + game.playtimeMinutes, 0),
      achievementTrackedCount: activeAchievementValues.length,
      achievementCoveragePercent: activeGames.length ? (activeAchievementValues.length / activeGames.length) * 100 : null,
      achievementAveragePercent: activeAchievementValues.length
        ? activeAchievementValues.reduce((sum, value) => sum + value, 0) / activeAchievementValues.length
        : null,
      primaryWarning: activeWarning,
    },
    counts: {
      totalGames: games.length,
      active: activeGames.length,
      installed: games.filter((game) => game.installed).length,
      completed: games.filter((game) => game.status === "completed").length,
      doneForNow: games.filter((game) => game.status === "done_for_now").length,
      dnf: games.filter((game) => game.status === "dnf").length,
      parked: games.filter((game) => game.status === "parked").length,
      doneForNowCandidates: games.filter(isDoneForNowCandidate).length,
      steamIdentified: games.filter((game) => game.steamAppId != null).length,
      totalPlaytimeMinutes: games.reduce((sum, game) => sum + game.playtimeMinutes, 0),
    },
    queue: {
      total: queuedGames.length,
      windowSize,
      nextWindowCount: Math.min(queuedGames.length, windowSize),
      eligibleUnqueued: queueEligibleUnqueued.length,
      importedReview: queueEligibleUnqueued.filter((game) => game.syncState === "imported").length,
      warningCount: warnings.filter((warning) => warning.code.includes("queue")).length,
    },
  };
}

function compareByTitle(a: GameSummary, b: GameSummary) {
  return a.title.localeCompare(b.title);
}

function getDateTime(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = typeof value === "string" ? new Date(value) : value;
  const time = parsed.getTime();
  return Number.isNaN(time) ? null : time;
}

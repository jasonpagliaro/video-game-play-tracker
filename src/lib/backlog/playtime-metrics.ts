import { formatDate, formatMinutes } from "./format";
import type { BacklogSlot, CompletionType } from "./constants";
import { OPEN_ENDED_COMPLETION_TYPES } from "./constants";

export type PlaytimeMetricSource = {
  playtimeMinutes: number | null | undefined;
  estimatedHours: number | null | undefined;
  lastPlayed: Date | string | null | undefined;
  backlogSlot?: BacklogSlot;
  completionType?: CompletionType;
};

export type PlaytimeMetrics = {
  played: string;
  typicalFinish: string;
  remaining: string;
  progress: string;
  lastPlayed: string;
  basis: string;
};

const FALLBACK_HOURS_BY_SLOT: Record<BacklogSlot, number | null> = {
  short: 4,
  narrative: 10,
  horror: 8,
  action: 14,
  puzzle: 8,
  rpg_long: 45,
  strategy: 25,
  coop: 16,
  experimental: 12,
  parking_lot: null,
};

const FALLBACK_HOURS_BY_COMPLETION_TYPE: Partial<Record<CompletionType, number | null>> = {
  completable: 12,
  roguelike: 20,
  unknown: 12,
  endless: null,
  sandbox: null,
  multiplayer: null,
  live_service: null,
};

export function getPlaytimeMetrics(source: PlaytimeMetricSource): PlaytimeMetrics {
  const playedMinutes = Math.max(0, source.playtimeMinutes ?? 0);
  const estimate = getEstimate(source);
  const estimateMinutes = estimate.minutes;

  if (estimateMinutes == null) {
    return {
      played: formatMinutes(playedMinutes),
      typicalFinish: estimate.openEnded ? "Open-ended" : "-",
      remaining: estimate.openEnded ? "Ongoing" : "-",
      progress: "-",
      lastPlayed: formatDate(source.lastPlayed),
      basis: estimate.basis,
    };
  }

  const remainingMinutes = estimateMinutes - playedMinutes;
  const progress = Math.round((playedMinutes / estimateMinutes) * 100);

  return {
    played: formatMinutes(playedMinutes),
    typicalFinish: formatMinutes(estimateMinutes),
    remaining: remainingMinutes > 0 ? formatMinutes(remainingMinutes) : "At / over estimate",
    progress: `${progress}%`,
    lastPlayed: formatDate(source.lastPlayed),
    basis: estimate.basis,
  };
}

function getEstimate(source: PlaytimeMetricSource): {
  minutes: number | null;
  basis: string;
  openEnded: boolean;
} {
  const savedEstimateMinutes = getEstimateMinutes(source.estimatedHours);
  if (savedEstimateMinutes != null) {
    return { minutes: savedEstimateMinutes, basis: "Saved estimate", openEnded: false };
  }

  if (source.completionType && OPEN_ENDED_COMPLETION_TYPES.includes(source.completionType)) {
    return { minutes: null, basis: "Open-ended type", openEnded: true };
  }

  const fallbackHours =
    (source.backlogSlot ? FALLBACK_HOURS_BY_SLOT[source.backlogSlot] : undefined) ??
    (source.completionType ? FALLBACK_HOURS_BY_COMPLETION_TYPE[source.completionType] : undefined);
  const fallbackEstimateMinutes = getEstimateMinutes(fallbackHours);

  if (fallbackEstimateMinutes != null) {
    return { minutes: fallbackEstimateMinutes, basis: "Category estimate", openEnded: false };
  }

  return { minutes: null, basis: "No estimate", openEnded: false };
}

function getEstimateMinutes(estimatedHours: number | null | undefined) {
  if (estimatedHours == null || !Number.isFinite(estimatedHours) || estimatedHours <= 0) return null;
  return Math.max(1, Math.round(estimatedHours * 60));
}

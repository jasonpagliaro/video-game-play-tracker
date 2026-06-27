import { formatDate, formatMinutes } from "./format";

export type PlaytimeMetricSource = {
  playtimeMinutes: number | null | undefined;
  estimatedHours: number | null | undefined;
  lastPlayed: Date | string | null | undefined;
};

export type PlaytimeMetrics = {
  played: string;
  typicalFinish: string;
  remaining: string;
  progress: string;
  lastPlayed: string;
};

export function getPlaytimeMetrics(source: PlaytimeMetricSource): PlaytimeMetrics {
  const playedMinutes = Math.max(0, source.playtimeMinutes ?? 0);
  const estimateMinutes = getEstimateMinutes(source.estimatedHours);

  if (estimateMinutes == null) {
    return {
      played: formatMinutes(playedMinutes),
      typicalFinish: "-",
      remaining: "-",
      progress: "-",
      lastPlayed: formatDate(source.lastPlayed),
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
  };
}

function getEstimateMinutes(estimatedHours: number | null | undefined) {
  if (estimatedHours == null || !Number.isFinite(estimatedHours) || estimatedHours <= 0) return null;
  return Math.max(1, Math.round(estimatedHours * 60));
}

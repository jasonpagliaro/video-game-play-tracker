export function formatMinutes(minutes: number | null | undefined) {
  const safe = Math.max(0, minutes ?? 0);
  if (safe < 60) return `${safe}m`;
  const hours = safe / 60;
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`;
}

export function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "-";
  const parsed = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) return "-";
  return `${Math.round(value)}%`;
}

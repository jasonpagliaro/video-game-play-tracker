export function normalizeTitle(title: string) {
  return title
    .replace(/[™®©]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseOptionalDate(value: unknown): Date | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseOptionalNumber(value: unknown): number | null {
  if (value == null) return null;
  const text = String(value).trim().replace("%", "");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toMinutesFromHours(value: unknown): number {
  const parsed = parseOptionalNumber(value);
  if (parsed == null) return 0;
  return Math.max(0, Math.round(parsed * 60));
}

export function splitList(value: unknown): string[] | null {
  if (value == null) return null;
  const parts = String(value)
    .split(/[;,|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : null;
}

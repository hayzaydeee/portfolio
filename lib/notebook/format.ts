/**
 * Dates as the notebook prints them. Formatted in UTC so the server's render and the
 * browser's hydration agree whatever the reader's time zone.
 */
export function formatEntryDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
}

export function formatReadTime(minutes: number | null): string | null {
  if (minutes == null) return null;
  return minutes < 1 ? "under a minute" : `${minutes} min read`;
}

export function countLabel(count: number): string {
  return count === 1 ? "1 entry" : `${count} entries`;
}

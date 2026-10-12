/**
 * Dates as the wall prints them, in UTC so the server's render and the browser's hydration
 * agree whatever the visitor's time zone.
 */
export function formatPinned(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).toLowerCase();
}

export function formatUnseals(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).toLowerCase();
}

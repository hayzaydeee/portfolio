import type { RoomKey } from "@/components/fx/runtime/types";

/**
 * The house plan: which room a URL belongs to and how the dock reaches each one.
 * Edge pages (/now, /colophon) live off the lobby, so they share its chrome.
 */

export type DockVariant = "sable" | "modern" | "retro" | "glass";

/** Admin-controlled visibility; the lobby is always open */
export type RoomVisibility = Record<Exclude<RoomKey, "lobby">, boolean>;

export type RoomLink = {
  room: Exclude<RoomKey, "lobby">;
  href: string;
  label: string;
};

export const ROOM_LINKS: readonly RoomLink[] = [
  { room: "workshop", href: "/work", label: "work" },
  { room: "notebook", href: "/notebook", label: "journal" },
  { room: "studio", href: "/music", label: "music" },
  { room: "wall", href: "/wall", label: "art" },
];

export const DOCK_VARIANT: Record<RoomKey, DockVariant> = {
  lobby: "sable",
  workshop: "retro",
  studio: "glass",
  notebook: "modern",
  wall: "modern",
};

export const CV_HREF = "/Divine%20Eze's%20Resume.pdf";
export const CONTACT_HREF = "mailto:hayzayd33@gmail.com";

const PREFIXES: readonly [string, RoomKey][] = [
  ["/work", "workshop"],
  ["/music", "studio"],
  ["/notebook", "notebook"],
  ["/wall", "wall"],
];

/** Routes that sit outside the house: no dock, no portal */
const OUTSIDE = ["/admin", "/fx-harness", "/api"];

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function roomForPath(pathname: string): RoomKey | null {
  const path = pathname.split(/[?#]/)[0] || "/";
  if (OUTSIDE.some((p) => matches(path, p))) return null;
  for (const [prefix, room] of PREFIXES) if (matches(path, prefix)) return room;
  return "lobby";
}

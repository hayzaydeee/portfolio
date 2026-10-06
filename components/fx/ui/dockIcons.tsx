import type { ReactNode } from "react";
import type { RoomKey } from "@/components/fx/runtime/types";

/**
 * Dock glyphs drawn for the rooms, in the two grids AnimatedTopDock uses: 16×16 strokes
 * for sable, modern and glass, and a 7×7 pixel grid for retro.
 */

export type DockIconKey = Exclude<RoomKey, "lobby"> | "more" | "cv" | "contact";

export const LINE_ICONS: Record<DockIconKey, ReactNode> = {
  workshop: (
    <>
      <path d="M5.6 4.4 2 8l3.6 3.6M10.4 4.4 14 8l-3.6 3.6" />
      <path d="M9.1 3 6.9 13" />
    </>
  ),
  notebook: (
    <>
      <path d="M3.2 2.4h7.6a1.8 1.8 0 0 1 1.8 1.8v9.4H5a1.8 1.8 0 0 1-1.8-1.8z" />
      <path d="M3.2 11.8A1.8 1.8 0 0 1 5 10h7.6M6 5.2h4" />
    </>
  ),
  studio: (
    <>
      <path d="M2 8h1.6M4.8 5.2v5.6M7.2 3v10M9.6 5.6v4.8M12 6.8v2.4M14 8h.01" />
    </>
  ),
  wall: (
    <>
      <rect x="2.4" y="3.6" width="11.2" height="10" rx="1.2" />
      <path d="m2.8 11.6 3.4-3.2 2.6 2.4 1.8-1.6 2.8 2.6M8 1.6v2" />
    </>
  ),
  more: (
    <>
      <circle cx="3.6" cy="8" r=".9" />
      <circle cx="8" cy="8" r=".9" />
      <circle cx="12.4" cy="8" r=".9" />
    </>
  ),
  cv: (
    <>
      <path d="M4 2.25h5.4L12 4.85v8.9H4z" />
      <path d="M8 6.4v4.4M6.2 9.2 8 11l1.8-1.8" />
    </>
  ),
  contact: (
    <>
      <rect x="2" y="3.4" width="12" height="9.2" rx="1.4" />
      <path d="m2.6 4.4 5.4 4.4 5.4-4.4" />
    </>
  ),
};

/** Pixel versions: each rect is one cell of a 7×7 grid */
export const PIXEL_ICONS: Record<DockIconKey, ReactNode> = {
  workshop: (
    <>
      <rect x="1" y="2" width="1" height="1" />
      <rect x="0" y="3" width="1" height="1" />
      <rect x="1" y="4" width="1" height="1" />
      <rect x="5" y="2" width="1" height="1" />
      <rect x="6" y="3" width="1" height="1" />
      <rect x="5" y="4" width="1" height="1" />
      <rect x="3" y="1" width="1" height="2" />
      <rect x="3" y="4" width="1" height="2" />
    </>
  ),
  notebook: (
    <>
      <rect x="1" y="0" width="5" height="1" />
      <rect x="1" y="1" width="1" height="6" />
      <rect x="5" y="1" width="1" height="5" />
      <rect x="2" y="6" width="4" height="1" />
      <rect x="3" y="2" width="2" height="1" />
      <rect x="3" y="4" width="2" height="1" />
    </>
  ),
  studio: (
    <>
      <rect x="0" y="3" width="1" height="1" />
      <rect x="2" y="2" width="1" height="3" />
      <rect x="4" y="0" width="1" height="7" />
      <rect x="6" y="2" width="1" height="3" />
    </>
  ),
  wall: (
    <>
      <rect x="0" y="1" width="7" height="1" />
      <rect x="0" y="2" width="1" height="5" />
      <rect x="6" y="2" width="1" height="5" />
      <rect x="1" y="6" width="5" height="1" />
      <rect x="2" y="4" width="1" height="1" />
      <rect x="3" y="3" width="1" height="1" />
      <rect x="4" y="4" width="1" height="1" />
      <rect x="3" y="0" width="1" height="1" />
    </>
  ),
  more: (
    <>
      <rect x="0" y="3" width="1" height="1" />
      <rect x="3" y="3" width="1" height="1" />
      <rect x="6" y="3" width="1" height="1" />
    </>
  ),
  cv: (
    <>
      <rect x="3" y="0" width="1" height="5" />
      <rect x="1" y="3" width="1" height="1" />
      <rect x="2" y="4" width="1" height="1" />
      <rect x="4" y="4" width="1" height="1" />
      <rect x="5" y="3" width="1" height="1" />
      <rect x="0" y="6" width="7" height="1" />
    </>
  ),
  contact: (
    <>
      <rect x="0" y="1" width="7" height="1" />
      <rect x="0" y="2" width="1" height="4" />
      <rect x="6" y="2" width="1" height="4" />
      <rect x="0" y="6" width="7" height="1" />
      <rect x="2" y="3" width="1" height="1" />
      <rect x="3" y="4" width="1" height="1" />
      <rect x="4" y="3" width="1" height="1" />
    </>
  ),
};

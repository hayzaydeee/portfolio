import type { FxMeta } from "@/components/fx/runtime/types";

export type StudioGalleryOptions = {
  /** Turn and bob speed, as a multiple of the original's */
  speed: number;
  scale: number;
  /** Panel opacity at rest (a hovered or selected panel goes to full) */
  opacity: number;
  /** A palette token key for the strips' accent instead of the room glow */
  accent: string;
};

/** One project as the gallery shows it; sent with `command("items", GalleryItem[])` */
export type GalleryItem = {
  title: string;
  /** e.g. "2024 · 6 tracks" */
  meta: string;
  /** A CORS-readable image URL, or null for a drawn strip */
  artwork: string | null;
};

export const studioGalleryMeta: FxMeta<StudioGalleryOptions> = {
  id: "studio-gallery",
  label: "Gallery",
  description:
    "Sixteen curved panels wound into a helix that turns and bobs, one strip per project: its artwork and title. Drag to spin it, click a panel to open the project.",
  source: { name: "ThreeUI · Gallery", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl2",
  priority: 1,
  pixelBudget: 1.5,
  rooms: ["studio", "lobby", "workshop"],
  defaults: { speed: 1, scale: 1, opacity: 0.85, accent: "" },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "scale", label: "scale", min: 0.7, max: 1.35, step: 0.01 },
    { kind: "range", key: "opacity", label: "panel opacity", min: 0.3, max: 1, step: 0.01 },
  ],
};

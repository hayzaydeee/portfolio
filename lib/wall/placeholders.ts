import type { WallPiece } from "@/lib/data/wall";

/** A piece with no media yet: its photo is a swatch of this colour */
export type PinnedPiece = WallPiece & { swatch?: string };

const piece = (id: string, caption: string, created: string, swatch: string, extra: Partial<WallPiece> = {}): PinnedPiece => ({
  id,
  type: "art",
  caption,
  description: null,
  image_path: null,
  preview_path: null,
  youtube_url: null,
  duration: null,
  alt_text: caption,
  status: "published",
  publish_at: null,
  created_at: created,
  swatch,
  ...extra,
});

/** What the wall shows while nothing is pinned to it yet */
export const PLACEHOLDER_PIECES: PinnedPiece[] = [
  piece("placeholder-1", "first time I got this right", "2026-01-10T00:00:00Z", "#C4855A", {
    description: "early sketch, rough around the edges, but something in it",
    alt_text: "A pencil study, early work",
  }),
  piece("placeholder-2", "made this at 2am, don't remember why", "2026-01-28T00:00:00Z", "#4A6B4A", { alt_text: "Abstract ink study" }),
  piece("placeholder-3", "this one took three weeks", "2026-02-14T00:00:00Z", "#1E2E5A", { alt_text: "Detailed charcoal drawing" }),
  piece("placeholder-4", "been thinking about this scene for months", "2026-02-20T00:00:00Z", "#6B1E2E", {
    type: "video_short",
    youtube_url: "https://youtube.com",
    alt_text: "Short film clip",
  }),
  piece("placeholder-5", "WIP, not sure where this is going yet", "2026-03-01T00:00:00Z", "#2A2E35", { alt_text: "Work in progress" }),
  piece("placeholder-6", "reference study", "2026-03-15T00:00:00Z", "#7A4F1E", { alt_text: "Reference study" }),
];

import type { SealedPiece } from "@/lib/data/wall";
import type { PinnedPiece } from "@/lib/wall/placeholders";

const art = (id: string, caption: string, created: string, image: string, extra: Partial<PinnedPiece> = {}): PinnedPiece => ({
  id,
  type: "art",
  caption,
  description: null,
  image_path: `/fx-test/wall/${image}.svg`,
  preview_path: null,
  youtube_url: null,
  duration: null,
  alt_text: caption,
  status: "published",
  publish_at: null,
  created_at: created,
  ...extra,
});

/**
 * The wall from fixtures: art with images (the harness's own SVGs), a long video with a poster
 * that links out, a piece with no media (a swatch), and two seals still waiting for their date.
 */
export const WALL_FIXTURE: PinnedPiece[] = [
  art("fixture-night", "the street after the rain stopped", "2026-09-30T00:00:00Z", "night", { description: "gouache on card, done in one sitting" }),
  art("fixture-reel", "a minute of the sea, cut to a song", "2026-09-12T00:00:00Z", "reel", {
    type: "video_long",
    duration: "4:12",
    youtube_url: "https://www.youtube.com/",
  }),
  art("fixture-poster", "poster for a show that didn't happen", "2026-08-20T00:00:00Z", "poster"),
  art("fixture-field", "the field behind my grandmother's house", "2026-07-02T00:00:00Z", "field"),
  art("fixture-ink", "ink, circling", "2026-06-14T00:00:00Z", "ink-study"),
  art("fixture-leaves", "leaves from the same tree, a week apart", "2026-05-03T00:00:00Z", "leaves"),
  art("fixture-charcoal", "charcoal, mostly smudge", "2026-04-11T00:00:00Z", "charcoal"),
  { ...art("fixture-swatch", "a colour I kept coming back to", "2026-03-01T00:00:00Z", "poster"), image_path: null, swatch: "#4A6B4A" },
];

export const SEALED_FIXTURE: SealedPiece[] = [
  { id: "sealed-1", type: "art", publish_at: "2027-03-21T09:00:00Z" },
  { id: "sealed-2", type: "video_short", publish_at: "2027-06-01T09:00:00Z" },
];

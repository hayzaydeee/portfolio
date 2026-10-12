import type { FxMeta } from "@/components/fx/runtime/types";

export type BookshelfOptions = {
  /** Tone-mapping exposure */
  exposure: number;
  /** Room environment strength on the cloth and foil */
  environment: number;
  /** How far the wall and floor lean toward the selected journal's colour */
  tint: number;
  /** Soft shadows from the key light */
  shadows: boolean;
};

/** One entry as a volume prints it: already formatted for the page */
export type ShelfVolumeEntry = {
  title: string;
  /** e.g. "12 March 2026" */
  date: string;
  /** e.g. "6 min read", or null */
  readTime: string | null;
  untitled: boolean;
};

/** One journal on the shelf; sent with `command("volumes", ShelfVolume[])` */
export type ShelfVolume = {
  id: string;
  title: string;
  /** A few words under the title */
  short: string;
  roman: string;
  /** Palette token key for the cloth, e.g. "notebook-reflections" */
  color: string;
  /** "12 entries" */
  countLabel: string;
  /** "kept since March 2025", or null for an empty journal */
  since: string | null;
  /** Newest first, at most six: one per printed page */
  entries: ShelfVolumeEntry[];
};

/** What the shelf reports from the canvas as `fx:shelf` events */
export type ShelfEvent =
  | { type: "select"; index: number }
  | { type: "hover"; index: number }
  | { type: "mode"; mode: "shelf" | "opening" | "detail" | "closing" }
  | { type: "book"; open: boolean; page: number; spreads: number }
  | { type: "entry"; index: number };

const sample = (titles: string[]): ShelfVolumeEntry[] =>
  titles.map((title, i) => ({ title, date: `March ${28 - i * 6}, 2026`, readTime: `${3 + i} min read`, untitled: false }));

/** What the shelf holds when a page sends no volumes (the lab, the effect harness) */
export const SAMPLE_VOLUMES: ShelfVolume[] = [
  ["reflections", "Reflections", "Long-form essays", "I", ["on staying", "the long obedience", "notes on noticing"]],
  ["fragments", "Fragments", "Short observations", "II", ["platform four", "rain on the skylight"]],
  ["annotations", "Annotations", "Scripture and theology", "III", ["psalm 46 in a loud week", "the margins of mark"]],
  ["responses", "Responses", "Film and music", "IV", ["after the credits"]],
  ["buildlog", "Build log", "Software and building", "V", ["shipping the shelf", "a renderer that waits"]],
  ["cookbook", "Cookbook", "Recipes and meals", "VI", []],
].map(([id, title, short, roman, titles]) => ({
  id: id as string,
  title: title as string,
  short: short as string,
  roman: roman as string,
  color: `notebook-${id}`,
  countLabel: `${(titles as string[]).length} entries`,
  since: "kept since 2025",
  entries: sample(titles as string[]),
}));

export const bookshelfMeta: FxMeta<BookshelfOptions> = {
  id: "bookshelf",
  label: "Bookshelf",
  description:
    "Six cloth-bound volumes on a walnut shelf, one per journal. Browse along the shelf, take one down to turn its pages (the journal's latest entries), and put it back.",
  source: { name: "ThreeUI · Bookshelf", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl2",
  priority: 1,
  pixelBudget: 1.6,
  rooms: ["notebook"],
  // The original's 0.9 suits its dark rooms; three's ACES scales exposure by 1/0.6, and in this cream room 0.9 washes the cloth to pastel
  defaults: { exposure: 0.55, environment: 0.6, tint: 0.16, shadows: true },
  controls: [
    { kind: "range", key: "exposure", label: "exposure", min: 0.5, max: 1.4, step: 0.01 },
    { kind: "range", key: "environment", label: "environment", min: 0, max: 1.5, step: 0.01 },
    { kind: "range", key: "tint", label: "room tint", min: 0, max: 0.5, step: 0.01 },
    { kind: "toggle", key: "shadows", label: "shadows" },
  ],
  demoCommands: [
    { label: "previous", name: "step", arg: -1 },
    { label: "next", name: "step", arg: 1 },
    { label: "take down", name: "inspect" },
    { label: "open / close", name: "book" },
    { label: "turn", name: "page", arg: 1 },
    { label: "put back", name: "close" },
  ],
};

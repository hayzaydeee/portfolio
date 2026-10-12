import type { FxMeta } from "@/components/fx/runtime/types";

export type GalleryRingOptions = {
  /** The headline's first line, set in the room's accent */
  title: string;
  /** The second line, set in the room's ink */
  subtitle: string;
  /** How each plate is shaded: halftone dots, a matte noise field, or a dithered print */
  field: "halftone" | "matte" | "riso";
  /** Screen angle of the ring's major axis, degrees: 90 loops the plates vertically */
  axis: number;
  /** Orbit speed while the pointer is over it, as a multiple of the original's one turn in 15 s */
  speed: number;
  /** Headline size, as a multiple of the original's cap height */
  headlineSize: number;
};

export const galleryRingMeta: FxMeta<GalleryRingOptions> = {
  id: "gallery-ring",
  label: "Gallery Ring",
  description:
    "An oversized headline ringed by twelve 4:3 plates, each one flat colour shaded by its own field, that hold still until the pointer arrives and then orbit, passing in front of and behind the type.",
  source: { name: "ThreeUI · Gallery Heading", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "2d",
  priority: 1,
  pixelBudget: 1.2,
  rooms: ["wall", "lobby", "workshop", "studio", "notebook"],
  defaults: { title: "THE WALL", subtitle: "PINNED OVER TIME", field: "halftone", axis: 90, speed: 1, headlineSize: 1.25 },
  controls: [
    {
      kind: "choice",
      key: "field",
      label: "plates",
      options: [
        { value: "halftone", label: "halftone" },
        { value: "matte", label: "matte" },
        { value: "riso", label: "riso" },
      ],
    },
    { kind: "range", key: "axis", label: "axis", min: -90, max: 90, step: 0.5 },
    { kind: "range", key: "speed", label: "speed", min: 0, max: 2.5, step: 0.05 },
    { kind: "range", key: "headlineSize", label: "headline", min: 0.7, max: 1.6, step: 0.01 },
  ],
};

import type { FxMeta } from "@/components/fx/runtime/types";

export type PortalFieldOptions = {
  /** Organic warp on the ring and the iris edge */
  warp: number;
  /** Ring brightness */
  intensity: number;
  /** Outer haze around the ring */
  fringe: number;
  /** Pointer parallax */
  pointerAmount: number;
  sourcePalette: boolean;
};

export const portalFieldMeta: FxMeta<PortalFieldOptions> = {
  id: "portal-field",
  label: "Portal Field",
  description:
    "Room transition: a warped glowing ring irises shut over the room you're leaving, waits as a small portal, then opens onto the next room.",
  source: { name: "ThreeUI · Portal Field", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 3,
  pixelBudget: 2.4,
  rooms: ["lobby", "workshop", "studio", "notebook", "wall"],
  demoCommands: [
    { label: "trip → studio", name: "demo", arg: "studio" },
    { label: "trip → workshop", name: "demo", arg: "workshop" },
    { label: "trip → notebook", name: "demo", arg: "notebook" },
  ],
  defaults: { warp: 1, intensity: 1, fringe: 1, pointerAmount: 1, sourcePalette: false },
  controls: [
    { kind: "range", key: "warp", label: "warp", min: 0, max: 2, step: 0.05 },
    { kind: "range", key: "intensity", label: "ring intensity", min: 0, max: 2, step: 0.05 },
    { kind: "range", key: "fringe", label: "fringe haze", min: 0, max: 2, step: 0.05 },
    { kind: "range", key: "pointerAmount", label: "pointer parallax", min: 0, max: 2, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};

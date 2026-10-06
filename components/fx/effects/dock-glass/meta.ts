import type { FxMeta } from "@/components/fx/runtime/types";

export type DockGlassOptions = {
  /** Beads drawn (the largest few are always included) */
  count: number;
  thickness: number;
  dispersion: number;
  specular: number;
  rim: number;
  drift: number;
  sourcePalette: boolean;
};

export const dockGlassMeta: FxMeta<DockGlassOptions> = {
  id: "dock-glass",
  label: "Dock · Glass Field",
  description:
    "The studio rail's backdrop: glass beads drifting over slow colour blooms, each refracting the blooms per channel for a chromatic edge.",
  source: { name: "ThreeUI · Animated Top Dock (glass)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 3,
  pixelBudget: 0.3,
  rooms: ["studio", "lobby", "workshop"],
  defaults: { count: 9, thickness: 0.115, dispersion: 0.05, specular: 0.85, rim: 0.5, drift: 1, sourcePalette: false },
  controls: [
    { kind: "range", key: "count", label: "beads", min: 3, max: 12, step: 1 },
    { kind: "range", key: "thickness", label: "thickness", min: 0, max: 0.3, step: 0.005 },
    { kind: "range", key: "dispersion", label: "dispersion", min: 0, max: 0.15, step: 0.005 },
    { kind: "range", key: "specular", label: "specular", min: 0, max: 1.5, step: 0.05 },
    { kind: "range", key: "rim", label: "rim", min: 0, max: 1.5, step: 0.05 },
    { kind: "range", key: "drift", label: "drift", min: 0, max: 3, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};

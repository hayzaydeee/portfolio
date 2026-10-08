import type { FxMeta } from "@/components/fx/runtime/types";

export type StreamConvergenceOptions = {
  speed: number;
  /** Separation of the three strands */
  fidelity: number;
  /** Overall light; the header keeps it faint so the title reads over it */
  intensity: number;
  sourcePalette: boolean;
};

export const streamConvergenceMeta: FxMeta<StreamConvergenceOptions> = {
  id: "stream-convergence",
  label: "Stream Convergence",
  description:
    "Three offset strands of light ride a slow diagonal wave and fold into each other, vignetted to nothing at the edges. Faint, behind an essay's title.",
  source: { name: "ThreeUI · Stream Convergence", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 0,
  pixelBudget: 0.4,
  rooms: ["studio", "lobby", "workshop"],
  defaults: { speed: 1, fidelity: 0.5, intensity: 0.28, sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "fidelity", label: "strand spread", min: 0, max: 1, step: 0.05 },
    { kind: "range", key: "intensity", label: "intensity", min: 0, max: 1.5, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};

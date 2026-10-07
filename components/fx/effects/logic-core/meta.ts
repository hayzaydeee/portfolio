import type { FxMeta } from "@/components/fx/runtime/types";

export type LogicCoreOptions = {
  speed: number;
  /** Data nodes orbiting the core */
  nodes: number;
  /** Core pulse strength */
  pulse: number;
  /** A palette token key to light the core in instead of the room glow */
  accent: string;
  sourcePalette: boolean;
};

export const logicCoreMeta: FxMeta<LogicCoreOptions> = {
  id: "logic-core",
  label: "Logic Core",
  description:
    "An isometric platform with a pulsing core and data nodes orbiting it, lit by the core's own light. A project page's identity field.",
  source: { name: "ThreeUI · Logic Core (Platform Core)", url: "https://github.com/MengTo/threeui", license: "MIT" },
  kind: "webgl",
  priority: 1,
  pixelBudget: 1.5,
  rooms: ["workshop", "lobby", "studio"],
  defaults: { speed: 1, nodes: 12, pulse: 1, accent: "", sourcePalette: false },
  controls: [
    { kind: "range", key: "speed", label: "speed", min: 0, max: 3, step: 0.05 },
    { kind: "range", key: "nodes", label: "nodes", min: 4, max: 24, step: 1 },
    { kind: "range", key: "pulse", label: "pulse", min: 0, max: 2, step: 0.05 },
    { kind: "toggle", key: "sourcePalette", label: "original colours" },
  ],
};

// Identity fields a project page can render (effect ids in components/fx/registry.ts).
// The admin picker only offers ids whose effect is registered; the full list is accepted
// here so saving a project never breaks while ports land in batches.
export const PROJECT_VISUALS = [
  "constellation-field",
  "particle-network",
  "gateway-flow",
  "connectivity-graph",
  "interface-lines",
  "topo-field",
  "warp-field",
  "logic-core",
  "topology-field",
  "data-field",
  "dimensional-field",
  "expanse-field",
  "orbital-sphere",
  "energy-orb",
  "structure-flow",
] as const;

export type ProjectVisual = (typeof PROJECT_VISUALS)[number];

// Palette token keys (the :root custom property name without the leading --)
export const ACCENT_TOKENS = [
  "workshop-syntax",
  "workshop-syntax-dim",
  "workshop-accent",
  "lobby-accent",
  "studio-accent-light",
  "notebook-reflections",
  "notebook-fragments",
  "notebook-annotations",
  "notebook-responses",
  "notebook-cookbook",
  "wall-pin",
] as const;

export type AccentToken = (typeof ACCENT_TOKENS)[number];

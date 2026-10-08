import { isFxId, type FxId } from "@/components/fx/metas";
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
  "warp-keycaps",
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

/** The identity fields that have actually been ported (a registered effect); the rest land in batches */
export const PORTED_VISUALS = PROJECT_VISUALS.filter((v): v is ProjectVisual & FxId => isFxId(v));

export const DEFAULT_VISUAL: ProjectVisual & FxId = "constellation-field";

/** What a project page draws: its chosen field if that one is ported, otherwise the default */
export function resolveVisual(variant: string | null | undefined): ProjectVisual & FxId {
  return PORTED_VISUALS.find((v) => v === variant) ?? DEFAULT_VISUAL;
}

export function isAccentToken(token: string | null | undefined): token is AccentToken {
  return !!token && (ACCENT_TOKENS as readonly string[]).includes(token);
}

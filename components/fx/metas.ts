import type { FxMeta, FxOptions } from "./runtime/types";
import { bellFieldMeta } from "./effects/bell-field/meta";
import { dockGlassMeta } from "./effects/dock-glass/meta";
import { dockRetroMeta } from "./effects/dock-retro/meta";
import { dotMatrixMeta } from "./effects/dot-matrix/meta";
import { condensationMeta } from "./effects/condensation/meta";
import { ignitionMeta } from "./effects/ignition/meta";
import { traceBorderMeta } from "./effects/trace-border/meta";
import { crtBootMeta } from "./effects/crt-boot/meta";
import { constellationFieldMeta } from "./effects/constellation-field/meta";
import { warpFieldMeta } from "./effects/warp-field/meta";
import { logicCoreMeta } from "./effects/logic-core/meta";
import { structureFlowMeta } from "./effects/structure-flow/meta";
import { orbitalSphereMeta } from "./effects/orbital-sphere/meta";
import { warpKeycapsMeta } from "./effects/warp-keycaps/meta";
import { emeraldHorizonMeta } from "./effects/emerald-horizon/meta";
import { generativeTreeMeta } from "./effects/generative-tree/meta";
import { glyphBallMeta } from "./effects/glyph-ball/meta";
import { glyphVortexMeta } from "./effects/glyph-vortex/meta";
import { hzyOrbMeta } from "./effects/hzy-orb/meta";
import { outlineTypeflowMeta } from "./effects/outline-typeflow/meta";
import { portalFieldMeta } from "./effects/portal-field/meta";

/**
 * Effect metadata only: no renderer code, so it is safe to import on the server
 * (preset validation, the lab, admin pickers).
 */
export const FX_METAS = {
  "bell-field": bellFieldMeta,
  "emerald-horizon": emeraldHorizonMeta,
  "dock-retro": dockRetroMeta,
  "dock-glass": dockGlassMeta,
  "portal-field": portalFieldMeta,
  "glyph-vortex": glyphVortexMeta,
  "hzy-orb": hzyOrbMeta,
  "glyph-ball": glyphBallMeta,
  "generative-tree": generativeTreeMeta,
  "outline-typeflow": outlineTypeflowMeta,
  "dot-matrix": dotMatrixMeta,
  "condensation": condensationMeta,
  "ignition": ignitionMeta,
  "trace-border": traceBorderMeta,
  "crt-boot": crtBootMeta,
  "constellation-field": constellationFieldMeta,
  "warp-field": warpFieldMeta,
  "logic-core": logicCoreMeta,
  "structure-flow": structureFlowMeta,
  "orbital-sphere": orbitalSphereMeta,
  "warp-keycaps": warpKeycapsMeta,
} as const satisfies Record<string, FxMeta<FxOptions>>;

export type FxId = keyof typeof FX_METAS;

export const FX_IDS = Object.keys(FX_METAS) as FxId[];

export function isFxId(id: string): id is FxId {
  return id in FX_METAS;
}

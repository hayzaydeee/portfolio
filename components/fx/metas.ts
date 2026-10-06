import type { FxMeta, FxOptions } from "./runtime/types";
import { bellFieldMeta } from "./effects/bell-field/meta";
import { emeraldHorizonMeta } from "./effects/emerald-horizon/meta";

/**
 * Effect metadata only: no renderer code, so it is safe to import on the server
 * (preset validation, the lab, admin pickers).
 */
export const FX_METAS = {
  "bell-field": bellFieldMeta,
  "emerald-horizon": emeraldHorizonMeta,
} as const satisfies Record<string, FxMeta<FxOptions>>;

export type FxId = keyof typeof FX_METAS;

export const FX_IDS = Object.keys(FX_METAS) as FxId[];

export function isFxId(id: string): id is FxId {
  return id in FX_METAS;
}

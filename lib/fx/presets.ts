import { FX_METAS } from "@/components/fx/metas";
import type { FxControl, FxOptions, FxOptionValue } from "@/components/fx/runtime/types";
import { FX_SLOTS, FX_SLOT_IDS, type FxSlotId } from "./slots";

export type SlotPreset = {
  /** Kill switch: off renders the poster only, without loading any effect code */
  enabled: boolean;
  /** Overrides on top of the effect's defaults, already validated */
  values: Partial<FxOptions>;
};

export type FxPresets = Record<FxSlotId, SlotPreset>;

function validateValue(control: FxControl, value: unknown): FxOptionValue | undefined {
  switch (control.kind) {
    case "range": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return undefined;
      return Math.min(control.max, Math.max(control.min, n));
    }
    case "toggle":
      return typeof value === "boolean" ? value : undefined;
    case "choice":
      return typeof value === "string" && control.options.some((o) => o.value === value) ? value : undefined;
  }
}

/** Keep only keys the effect declares as controls, clamped to their ranges */
export function sanitizeValues(slot: FxSlotId, raw: unknown): Partial<FxOptions> {
  const meta = FX_METAS[FX_SLOTS[slot].effect];
  const out: Partial<FxOptions> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const control of meta.controls) {
    const v = validateValue(control, (raw as Record<string, unknown>)[control.key]);
    if (v !== undefined) out[control.key] = v;
  }
  return out;
}

/** Turn the stored jsonb into a complete, safe preset map. Never throws. */
export function resolvePresets(raw: unknown): FxPresets {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const presets = {} as FxPresets;
  for (const slot of FX_SLOT_IDS) {
    const entry = source[slot];
    const obj = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
    presets[slot] = {
      enabled: typeof obj.enabled === "boolean" ? obj.enabled : true,
      values: sanitizeValues(slot, obj.values),
    };
  }
  return presets;
}

"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FxPresets, SlotPreset } from "@/lib/fx/presets";
import type { FxSlotId } from "@/lib/fx/slots";

const FxConfigContext = createContext<FxPresets | null>(null);

/** Static per-document config from the root layout; consumers never re-render from it */
export function FxConfigProvider({ presets, children }: { presets: FxPresets; children: ReactNode }) {
  return <FxConfigContext.Provider value={presets}>{children}</FxConfigContext.Provider>;
}

export function useSlotPreset(slot: FxSlotId | undefined): SlotPreset | null {
  const presets = useContext(FxConfigContext);
  if (!slot || !presets) return null;
  return presets[slot] ?? null;
}

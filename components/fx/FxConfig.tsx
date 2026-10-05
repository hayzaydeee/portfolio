"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_GLOBALS, type FxGlobals, type FxPresets, type SlotPreset } from "@/lib/fx/presets";
import type { FxSlotId } from "@/lib/fx/slots";

type FxConfig = { presets: FxPresets; globals: FxGlobals };

const FxConfigContext = createContext<FxConfig | null>(null);

/** Static per-document config from the root layout; consumers never re-render from it */
export function FxConfigProvider({
  presets,
  globals,
  children,
}: FxConfig & { children: ReactNode }) {
  return <FxConfigContext.Provider value={{ presets, globals }}>{children}</FxConfigContext.Provider>;
}

export function useSlotPreset(slot: FxSlotId | undefined): SlotPreset | null {
  const config = useContext(FxConfigContext);
  if (!slot || !config) return null;
  return config.presets[slot] ?? null;
}

export function useFxGlobals(): FxGlobals {
  return useContext(FxConfigContext)?.globals ?? DEFAULT_GLOBALS;
}

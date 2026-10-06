"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { SITE_CONFIG_TAG } from "@/lib/data/settings";
import { GLOBALS_KEY, isTransitionStyle, sanitizeValues, type TransitionStyle } from "@/lib/fx/presets";
import { isFxSlotId } from "@/lib/fx/slots";

export type FxActionState = { success: boolean; error?: string };

async function readPresets() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("site_settings").select("id, fx_presets").limit(1).single();
  if (error || !data) {
    const missingColumn = error?.message?.includes("fx_presets");
    return {
      supabase,
      error: missingColumn
        ? "fx_presets column missing: apply supabase/migrations/20261005120000_fx_overhaul.sql"
        : (error?.message ?? "Settings row not found"),
    } as const;
  }
  return { supabase, id: data.id as string, current: (data.fx_presets as Record<string, unknown> | null) ?? {} } as const;
}

/** Save one slot's tuned values (validated against the effect's controls) into fx_presets */
export async function saveFxPreset(
  slot: string,
  preset: { enabled: boolean; values: Record<string, unknown> }
): Promise<FxActionState> {
  await requireAdmin();
  if (!isFxSlotId(slot)) return { success: false, error: "Unknown slot" };

  try {
    const read = await readPresets();
    if ("error" in read) return { success: false, error: read.error };

    const next = {
      ...read.current,
      [slot]: { enabled: preset.enabled === true, values: sanitizeValues(slot, preset.values) },
    };
    const { error: updateError } = await read.supabase
      .from("site_settings")
      .update({ fx_presets: next })
      .eq("id", read.id);
    if (updateError) return { success: false, error: updateError.message };

    updateTag(SITE_CONFIG_TAG);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save preset" };
  }
}

/** Save the site-wide room transition style */
export async function saveTransitionStyle(style: TransitionStyle): Promise<FxActionState> {
  await requireAdmin();
  if (!isTransitionStyle(style)) return { success: false, error: "Unknown transition" };

  try {
    const read = await readPresets();
    if ("error" in read) return { success: false, error: read.error };

    const global = read.current[GLOBALS_KEY];
    const next = {
      ...read.current,
      [GLOBALS_KEY]: { ...(global && typeof global === "object" ? global : {}), transition: style },
    };
    const { error: updateError } = await read.supabase
      .from("site_settings")
      .update({ fx_presets: next })
      .eq("id", read.id);
    if (updateError) return { success: false, error: updateError.message };

    updateTag(SITE_CONFIG_TAG);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save transition" };
  }
}

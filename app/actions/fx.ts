"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { SITE_CONFIG_TAG } from "@/lib/data/settings";
import { GLOBALS_KEY, isPlateStyle, isTransitionStyle, sanitizeValues, type PlateStyle, type TransitionStyle } from "@/lib/fx/presets";
import { isFxSlotId } from "@/lib/fx/slots";
import { isJournal } from "@/lib/notebook/journals";

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

/** Merge one site-wide choice into fx_presets.__global, keeping the others */
async function saveGlobal(patch: (global: Record<string, unknown>) => Record<string, unknown>, failure: string): Promise<FxActionState> {
  try {
    const read = await readPresets();
    if ("error" in read) return { success: false, error: read.error };

    const raw = read.current[GLOBALS_KEY];
    const global = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const next = { ...read.current, [GLOBALS_KEY]: patch(global) };
    const { error: updateError } = await read.supabase
      .from("site_settings")
      .update({ fx_presets: next })
      .eq("id", read.id);
    if (updateError) return { success: false, error: updateError.message };

    updateTag(SITE_CONFIG_TAG);
    return { success: true };
  } catch {
    return { success: false, error: failure };
  }
}

/** Save the site-wide room transition style */
export async function saveTransitionStyle(style: TransitionStyle): Promise<FxActionState> {
  await requireAdmin();
  if (!isTransitionStyle(style)) return { success: false, error: "Unknown transition" };
  return saveGlobal((g) => ({ ...g, transition: style }), "Failed to save transition");
}

/** Save which plate sits behind one journal's entry headers */
export async function savePlateStyle(journal: string, style: PlateStyle): Promise<FxActionState> {
  await requireAdmin();
  if (!isJournal(journal)) return { success: false, error: "Unknown journal" };
  if (!isPlateStyle(style)) return { success: false, error: "Unknown plate" };
  return saveGlobal((g) => {
    const plates = g.plates && typeof g.plates === "object" ? (g.plates as Record<string, unknown>) : {};
    return { ...g, plates: { ...plates, [journal]: style } };
  }, "Failed to save plate");
}

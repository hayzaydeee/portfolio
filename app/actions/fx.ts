"use server";

import { updateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { SITE_CONFIG_TAG } from "@/lib/data/settings";
import { sanitizeValues } from "@/lib/fx/presets";
import { isFxSlotId } from "@/lib/fx/slots";

export type FxActionState = { success: boolean; error?: string };

/** Save one slot's tuned values (validated against the effect's controls) into fx_presets */
export async function saveFxPreset(
  slot: string,
  preset: { enabled: boolean; values: Record<string, unknown> }
): Promise<FxActionState> {
  await requireAdmin();
  if (!isFxSlotId(slot)) return { success: false, error: "Unknown slot" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("id, fx_presets")
      .limit(1)
      .single();

    if (error || !data) {
      const missingColumn = error?.message?.includes("fx_presets");
      return {
        success: false,
        error: missingColumn
          ? "fx_presets column missing: apply supabase/migrations/20261005120000_fx_overhaul.sql"
          : (error?.message ?? "Settings row not found"),
      };
    }

    const current = (data.fx_presets as Record<string, unknown> | null) ?? {};
    const next = {
      ...current,
      [slot]: { enabled: preset.enabled === true, values: sanitizeValues(slot, preset.values) },
    };

    const { error: updateError } = await supabase
      .from("site_settings")
      .update({ fx_presets: next })
      .eq("id", data.id);
    if (updateError) return { success: false, error: updateError.message };

    updateTag(SITE_CONFIG_TAG);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save preset" };
  }
}

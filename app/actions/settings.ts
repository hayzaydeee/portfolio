"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidateContent } from "@/lib/revalidate";
import { highlight } from "@/lib/shiki";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StackJson = {
  languages: string[];
  frontend: string[];
  backend: string[];
  tools: string[];
};

export type SiteSettings = {
  id: string;
  room_workshop_visible: boolean;
  room_studio_visible: boolean;
  room_notebook_visible: boolean;
  room_wall_visible: boolean;
  bito_webhook_secret: string | null;
  last_bito_webhook_at: string | null;
  stack_json: StackJson | null;
  updated_at: string;
};

export type SettingsActionState = {
  success: boolean;
  error?: string;
  message?: string;
};

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<SiteSettings | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as SiteSettings;
  } catch {
    return null;
  }
}

// ─── Room visibility ───────────────────────────────────────────────────────────

const visibilitySchema = z.object({
  room_workshop_visible: z.boolean(),
  room_studio_visible: z.boolean(),
  room_notebook_visible: z.boolean(),
  room_wall_visible: z.boolean(),
});

export async function updateRoomVisibility(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const raw = {
    room_workshop_visible: formData.get("room_workshop_visible") === "true",
    room_studio_visible: formData.get("room_studio_visible") === "true",
    room_notebook_visible: formData.get("room_notebook_visible") === "true",
    room_wall_visible: formData.get("room_wall_visible") === "true",
  };

  const parsed = visibilitySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Invalid visibility settings" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("site_settings")
      .update(parsed.data)
      .not("id", "is", null); // update the single row

    if (error) return { success: false, error: error.message };

    revalidateContent("settings");
    return { success: true, message: "Visibility updated" };
  } catch {
    return { success: false, error: "Failed to update visibility" };
  }
}

// ─── Bito webhook secret ───────────────────────────────────────────────────────

export async function regenerateBitoSecret(): Promise<
  SettingsActionState & { secret?: string }
> {
  // Generate a cryptographically random 32-byte hex secret
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const newSecret = Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("site_settings")
      .update({ bito_webhook_secret: newSecret })
      .not("id", "is", null);

    if (error) return { success: false, error: error.message };

    return { success: true, secret: newSecret };
  } catch {
    return { success: false, error: "Failed to regenerate secret" };
  }
}

// ─── Deploy hook ───────────────────────────────────────────────────────────────

export async function triggerRedeploy(): Promise<SettingsActionState> {
  const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!deployHookUrl) {
    return { success: false, error: "Deploy hook URL not configured" };
  }

  try {
    const res = await fetch(deployHookUrl, { method: "POST" });
    if (!res.ok) return { success: false, error: `Deploy hook failed: ${res.status}` };

    return { success: true, message: "Redeploy triggered" };
  } catch {
    return { success: false, error: "Failed to trigger redeploy" };
  }
}

// ─── Stack JSON ───────────────────────────────────────────────────────────

const stackItemSchema = z.array(z.string().max(50)).max(30).default([]);

const stackJsonSchema = z.object({
  languages: stackItemSchema,
  frontend: stackItemSchema,
  backend: stackItemSchema,
  tools: stackItemSchema,
});

function formatStackAsJsonc(stack: StackJson): string {
  const base = JSON.stringify(
    {
      languages: stack.languages,
      frontend: stack.frontend,
      backend: stack.backend,
      tools: stack.tools,
    },
    null,
    2
  );
  return base.replace(/\n}$/, "\n  // yes this file has comments. yes i know.\n}");
}

export async function getHighlightedStackJson(stack: StackJson): Promise<string> {
  const jsonc = formatStackAsJsonc(stack);
  try {
    return await highlight(jsonc, "jsonc");
  } catch {
    return `<pre style="color:#A8C5A0">${jsonc.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;
  }
}

export async function updateStackJson(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  let raw: { languages: string[]; frontend: string[]; backend: string[]; tools: string[] };
  try {
    raw = {
      languages: JSON.parse((formData.get("languages") as string) || "[]"),
      frontend: JSON.parse((formData.get("frontend") as string) || "[]"),
      backend: JSON.parse((formData.get("backend") as string) || "[]"),
      tools: JSON.parse((formData.get("tools") as string) || "[]"),
    };
  } catch {
    return { success: false, error: "Invalid JSON in stack fields" };
  }

  const parsed = stackJsonSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid stack data" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("site_settings")
      .update({ stack_json: parsed.data })
      .not("id", "is", null);

    if (error) return { success: false, error: error.message };

    revalidateContent("settings");
    revalidatePath("/work");
    return { success: true, message: "Stack saved" };
  } catch {
    return { success: false, error: "Failed to save stack" };
  }
}

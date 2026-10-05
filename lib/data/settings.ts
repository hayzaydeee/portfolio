import "server-only";
import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { highlight } from "@/lib/shiki";
import type { RoomVisibility } from "@/lib/rooms";

export type StackJson = {
  languages: string[];
  frontend: string[];
  backend: string[];
  tools: string[];
};

export type { RoomVisibility } from "@/lib/rooms";

/** Public-safe slice of site_settings. The webhook secret never leaves getSiteConfig. */
export type PublicSiteConfig = {
  stackJson: StackJson | null;
  rooms: RoomVisibility;
  /** Raw jsonb; validated and merged over code defaults by lib/fx/presets.ts */
  fxPresetsRaw: unknown;
};

export const SITE_CONFIG_TAG = "site-config";

const ALL_ROOMS_VISIBLE: RoomVisibility = { workshop: true, studio: true, notebook: true, wall: true };

const DEFAULT_CONFIG: PublicSiteConfig = {
  stackJson: null,
  rooms: ALL_ROOMS_VISIBLE,
  fxPresetsRaw: {},
};

async function readSiteConfig(): Promise<PublicSiteConfig> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return DEFAULT_CONFIG;
  }
  try {
    // select("*") so this keeps working before and after the fx_presets migration is applied
    const { data, error } = await createServiceClient()
      .from("site_settings")
      .select("*")
      .limit(1)
      .single();
    if (error || !data) return DEFAULT_CONFIG;
    return {
      stackJson: (data.stack_json as StackJson | null) ?? null,
      rooms: {
        workshop: data.room_workshop_visible ?? true,
        studio: data.room_studio_visible ?? true,
        notebook: data.room_notebook_visible ?? true,
        wall: data.room_wall_visible ?? true,
      },
      fxPresetsRaw: data.fx_presets ?? {},
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Cached across requests; invalidated with updateTag(SITE_CONFIG_TAG) from admin actions. */
export const getSiteConfig = unstable_cache(readSiteConfig, ["site-config-v1"], {
  tags: [SITE_CONFIG_TAG],
  revalidate: 300,
});

export function formatStackAsJsonc(stack: StackJson): string {
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

export async function highlightStackJson(stack: StackJson): Promise<string> {
  const jsonc = formatStackAsJsonc(stack);
  try {
    return await highlight(jsonc, "jsonc");
  } catch {
    return `<pre style="color:#A8C5A0">${jsonc.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre>`;
  }
}

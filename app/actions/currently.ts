"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidateContent } from "@/lib/revalidate";
import type { Currently } from "@/lib/data/currently";

const currentlySchema = z.object({
  type: z.enum(["project", "music", "thought", "film", "book"]),
  verb: z.string().min(1).max(50),
  content: z.string().min(1).max(300),
  link: z.string().url().optional().or(z.literal("")),
});

export type CurrentlyActionState = {
  success: boolean;
  error?: string;
};

export async function upsertCurrently(
  _prev: CurrentlyActionState,
  formData: FormData
): Promise<CurrentlyActionState> {
  const raw = {
    type: formData.get("type"),
    verb: formData.get("verb"),
    content: formData.get("content"),
    link: formData.get("link") || "",
  };

  const parsed = currentlySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { type, verb, content, link } = parsed.data;

  try {
    const supabase = await createClient();

    // Deactivate all existing rows
    await supabase.from("currently").update({ is_active: false }).eq("is_active", true);

    // Insert new active row
    const { error } = await supabase.from("currently").insert({
      type,
      verb,
      content,
      link: link || null,
      is_active: true,
    });

    if (error) return { success: false, error: error.message };

    revalidateContent("currently");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update currently" };
  }
}

export async function getCurrentlyHistory(): Promise<Currently[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("currently")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data as Currently[];
  } catch {
    return [];
  }
}

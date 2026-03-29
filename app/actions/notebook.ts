"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidateContent } from "@/lib/revalidate";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotebookEntry = {
  id: string;
  slug: string;
  journal: "reflections" | "fragments" | "annotations" | "responses" | "buildlog";
  title: string | null;
  content: string | null;
  body_html: string | null;
  read_time_minutes: number | null;
  source: "admin" | "bito";
  status: "published" | "draft" | "staged" | "rejected" | "archived";
  tags: string[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type NotebookActionState = {
  success: boolean;
  error?: string;
  id?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateReadTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function generateSlug(title: string | null, id: string): string {
  if (!title) return id.slice(0, 8);
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

// ─── Validation ───────────────────────────────────────────────────────────────

const entrySchema = z.object({
  journal: z.enum(["reflections", "fragments", "annotations", "responses", "buildlog"]),
  title: z.string().max(200).optional().or(z.literal("")),
  body_html: z.string().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  status: z.enum(["published", "draft", "archived"]).optional(),
});

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getAllEntries(): Promise<NotebookEntry[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notebook_entries")
      .select("*")
      .in("status", ["published", "draft", "archived"])
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as NotebookEntry[];
  } catch {
    return [];
  }
}

export async function getStagedEntries(): Promise<NotebookEntry[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notebook_entries")
      .select("*")
      .eq("status", "staged")
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as NotebookEntry[];
  } catch {
    return [];
  }
}

export async function getEntryById(id: string): Promise<NotebookEntry | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notebook_entries")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as NotebookEntry;
  } catch {
    return null;
  }
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createEntry(
  _prev: NotebookActionState,
  formData: FormData
): Promise<NotebookActionState> {
  const raw = {
    journal: formData.get("journal"),
    title: formData.get("title") || "",
    body_html: formData.get("body_html") || "",
    tags: JSON.parse((formData.get("tags") as string) || "[]"),
    status: formData.get("status") || "draft",
  };

  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { journal, title, body_html, tags, status } = parsed.data;
  const tempId = crypto.randomUUID();
  const slug = generateSlug(title ?? null, tempId);
  const read_time = body_html ? estimateReadTime(body_html) : null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notebook_entries")
      .insert({
        id: tempId,
        slug,
        journal,
        title: title || null,
        body_html: body_html || null,
        read_time_minutes: read_time,
        source: "admin",
        status: status ?? "draft",
        tags: tags ?? [],
        published_at: status === "published" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    revalidateContent("notebook");
    return { success: true, id: data.id };
  } catch {
    return { success: false, error: "Failed to create entry" };
  }
}

// ─── Update ────────────────────────────────────────────────────────────────────

export async function updateEntry(
  id: string,
  _prev: NotebookActionState,
  formData: FormData
): Promise<NotebookActionState> {
  const raw = {
    journal: formData.get("journal"),
    title: formData.get("title") || "",
    body_html: formData.get("body_html") || "",
    tags: JSON.parse((formData.get("tags") as string) || "[]"),
    status: formData.get("status") || "draft",
  };

  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { journal, title, body_html, tags, status } = parsed.data;
  const read_time = body_html ? estimateReadTime(body_html) : null;

  try {
    const supabase = await createClient();

    // Get existing to check if we need to set published_at
    const { data: existing } = await supabase
      .from("notebook_entries")
      .select("status, published_at, title, slug")
      .eq("id", id)
      .single();

    const newSlug =
      title && existing?.title !== title ? generateSlug(title, id) : existing?.slug ?? id;

    const { error } = await supabase
      .from("notebook_entries")
      .update({
        slug: newSlug,
        journal,
        title: title || null,
        body_html: body_html || null,
        read_time_minutes: read_time,
        status: status ?? "draft",
        tags: tags ?? [],
        published_at:
          status === "published" && existing?.status !== "published"
            ? new Date().toISOString()
            : existing?.published_at ?? null,
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateContent("notebook");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update entry" };
  }
}

// ─── Stage approve / reject ────────────────────────────────────────────────────

export async function approveEntry(id: string): Promise<NotebookActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notebook_entries")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "staged");

    if (error) return { success: false, error: error.message };

    revalidateContent("notebook");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to approve entry" };
  }
}

export async function rejectEntry(id: string): Promise<NotebookActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notebook_entries")
      .update({ status: "rejected" })
      .eq("id", id)
      .eq("status", "staged");

    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch {
    return { success: false, error: "Failed to reject entry" };
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────────

export async function deleteEntry(id: string): Promise<NotebookActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("notebook_entries").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateContent("notebook");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete entry" };
  }
}

// ─── Autosave ──────────────────────────────────────────────────────────────────

export async function autosaveEntry(
  id: string,
  body_html: string
): Promise<{ success: boolean }> {
  try {
    const supabase = await createClient();
    const read_time = estimateReadTime(body_html);
    const { error } = await supabase
      .from("notebook_entries")
      .update({ body_html, read_time_minutes: read_time })
      .eq("id", id)
      .neq("status", "published"); // never auto-publish

    return { success: !error };
  } catch {
    return { success: false };
  }
}


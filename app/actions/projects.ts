"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { revalidateContent } from "@/lib/revalidate";
import { PROJECT_VISUALS, ACCENT_TOKENS, type ProjectVisual, type AccentToken } from "@/lib/fx/projectVisuals";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Project = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  problem_notes: string | null;
  build_notes: string | null;
  stack: string[];
  personal_note: string | null;
  live_url: string | null;
  repo_url: string | null;
  thumbnail_url: string | null;
  is_featured: boolean;
  status: "published" | "draft" | "archived" | "in_progress";
  order_index: number;
  visual_variant: ProjectVisual | null;
  visual_accent: AccentToken | null;
  created_at: string;
  updated_at: string;
};

export type ProjectActionState = {
  success: boolean;
  error?: string;
  id?: string;
};

// ─── Validation ───────────────────────────────────────────────────────────────

const projectSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  title: z.string().min(1).max(100),
  tagline: z.string().max(100).optional().or(z.literal("")),
  problem_notes: z.string().optional(),
  build_notes: z.string().optional(),
  stack: z.array(z.string()).optional(),
  personal_note: z.string().max(200).optional().or(z.literal("")),
  live_url: z.string().url().optional().or(z.literal("")),
  repo_url: z.string().url().optional().or(z.literal("")),
  thumbnail_url: z.string().optional().or(z.literal("")),
  is_featured: z.boolean().optional(),
  status: z.enum(["published", "draft", "archived", "in_progress"]).optional(),
  order_index: z.coerce.number().int().min(0).optional(),
  visual_variant: z.enum(PROJECT_VISUALS).optional().or(z.literal("")),
  visual_accent: z.enum(ACCENT_TOKENS).optional().or(z.literal("")),
});

/**
 * Visual fields are only written when the form sends them, so saving still works on a
 * database where the fx_overhaul migration hasn't been applied yet.
 */
function readVisualFields(formData: FormData) {
  const fields: { visual_variant?: string; visual_accent?: string } = {};
  if (formData.has("visual_variant")) fields.visual_variant = (formData.get("visual_variant") as string) ?? "";
  if (formData.has("visual_accent")) fields.visual_accent = (formData.get("visual_accent") as string) ?? "";
  return fields;
}

function visualColumns(data: { visual_variant?: string; visual_accent?: string }) {
  const cols: { visual_variant?: string | null; visual_accent?: string | null } = {};
  if (data.visual_variant !== undefined) cols.visual_variant = data.visual_variant || null;
  if (data.visual_accent !== undefined) cols.visual_accent = data.visual_accent || null;
  return cols;
}

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getAllProjects(): Promise<Project[]> {
  await requireAdmin();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("order_index", { ascending: true });

    if (error || !data) return [];
    return data as Project[];
  } catch {
    return [];
  }
}

export async function getProjectById(id: string): Promise<Project | null> {
  await requireAdmin();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as Project;
  } catch {
    return null;
  }
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createProject(
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  await requireAdmin();
  const raw = {
    slug: formData.get("slug"),
    title: formData.get("title"),
    tagline: formData.get("tagline") || "",
    problem_notes: formData.get("problem_notes") || "",
    build_notes: formData.get("build_notes") || "",
    stack: JSON.parse((formData.get("stack") as string) || "[]"),
    personal_note: formData.get("personal_note") || "",
    live_url: formData.get("live_url") || "",
    repo_url: formData.get("repo_url") || "",
    thumbnail_url: formData.get("thumbnail_url") || "",
    is_featured: formData.get("is_featured") === "true",
    status: formData.get("status") || "draft",
    order_index: formData.get("order_index") || 0,
    ...readVisualFields(formData),
  };

  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        ...parsed.data,
        tagline: parsed.data.tagline || null,
        personal_note: parsed.data.personal_note || null,
        live_url: parsed.data.live_url || null,
        repo_url: parsed.data.repo_url || null,
        thumbnail_url: parsed.data.thumbnail_url || null,
        ...visualColumns(parsed.data),
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    revalidateContent("project");
    return { success: true, id: data.id };
  } catch {
    return { success: false, error: "Failed to create project" };
  }
}

// ─── Update ────────────────────────────────────────────────────────────────────

export async function updateProject(
  id: string,
  _prev: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  await requireAdmin();
  const raw = {
    slug: formData.get("slug"),
    title: formData.get("title"),
    tagline: formData.get("tagline") || "",
    problem_notes: formData.get("problem_notes") || "",
    build_notes: formData.get("build_notes") || "",
    stack: JSON.parse((formData.get("stack") as string) || "[]"),
    personal_note: formData.get("personal_note") || "",
    live_url: formData.get("live_url") || "",
    repo_url: formData.get("repo_url") || "",
    thumbnail_url: formData.get("thumbnail_url") || "",
    is_featured: formData.get("is_featured") === "true",
    status: formData.get("status") || "draft",
    order_index: formData.get("order_index") || 0,
    ...readVisualFields(formData),
  };

  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update({
        ...parsed.data,
        tagline: parsed.data.tagline || null,
        personal_note: parsed.data.personal_note || null,
        live_url: parsed.data.live_url || null,
        repo_url: parsed.data.repo_url || null,
        thumbnail_url: parsed.data.thumbnail_url || null,
        ...visualColumns(parsed.data),
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateContent("project");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update project" };
  }
}

// ─── Archive / Delete ──────────────────────────────────────────────────────────

export async function archiveProject(id: string): Promise<ProjectActionState> {
  await requireAdmin();
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("projects")
      .update({ status: "archived" })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateContent("project");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to archive project" };
  }
}

export async function deleteProject(
  id: string,
  confirmTitle: string
): Promise<ProjectActionState> {
  await requireAdmin();
  // Verify the project exists and the title matches
  const project = await getProjectById(id);
  if (!project) return { success: false, error: "Project not found" };
  if (project.title !== confirmTitle) {
    return { success: false, error: "Title does not match" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("projects").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateContent("project");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete project" };
  }
}

// ─── Reorder ───────────────────────────────────────────────────────────────────

export async function reorderProjects(
  orderedIds: string[]
): Promise<ProjectActionState> {
  await requireAdmin();
  try {
    const supabase = await createClient();

    const updates = orderedIds.map((id, index) =>
      supabase.from("projects").update({ order_index: index }).eq("id", id)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) return { success: false, error: failed.error.message };

    revalidateContent("project");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to reorder projects" };
  }
}

// ─── Media Upload ──────────────────────────────────────────────────────────────

export async function uploadProjectThumbnail(
  projectId: string,
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };

  // MIME type check via magic number (first 4 bytes)
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer).slice(0, 4);
  const allowed = [
    [0xff, 0xd8, 0xff], // JPEG
    [0x89, 0x50, 0x4e, 0x47], // PNG
    [0x52, 0x49, 0x46, 0x46], // WebP (RIFF)
  ];
  const isAllowed = allowed.some((sig) => sig.every((b, i) => bytes[i] === b));
  if (!isAllowed) return { success: false, error: "Only JPEG, PNG, and WebP are supported" };

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "File too large (max 5MB)" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;

  try {
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("projects")
      .upload(filename, file, { contentType: file.type, upsert: false });

    if (uploadError) return { success: false, error: uploadError.message };

    const { data: urlData } = supabase.storage.from("projects").getPublicUrl(filename);

    // Update project record
    await supabase
      .from("projects")
      .update({ thumbnail_url: urlData.publicUrl })
      .eq("id", projectId);

    revalidateContent("project");
    return { success: true, url: urlData.publicUrl };
  } catch {
    return { success: false, error: "Upload failed" };
  }
}


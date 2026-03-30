"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidateContent } from "@/lib/revalidate";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MusicProject = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  artwork_path: string | null;
  release_year: number | null;
  is_featured: boolean;
  is_wip: boolean;
  status: "published" | "draft" | "archived";
  sort_order: number;
  created_at: string;
  updated_at: string;
  tracks?: Track[];
};

export type Track = {
  id: string;
  music_project_id: string;
  title: string;
  audio_path: string | null;
  duration_seconds: number | null;
  track_number: number;
  created_at: string;
};

export type AnalysisEssay = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  content: string | null;
  body_html: string | null;
  read_time_minutes: number | null;
  status: "published" | "draft" | "archived";
  created_at: string;
  updated_at: string;
};

export type StudioActionState = {
  success: boolean;
  error?: string;
  id?: string;
};

// ─── Validation ───────────────────────────────────────────────────────────────

const musicProjectSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  title: z.string().min(1).max(100),
  description: z.string().max(150).optional().or(z.literal("")),
  release_year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  is_featured: z.boolean().optional(),
  is_wip: z.boolean().optional(),
  status: z.enum(["published", "draft", "archived"]).optional(),
  sort_order: z.coerce.number().int().min(0).optional(),
});

const trackSchema = z.object({
  title: z.string().min(1).max(200),
  track_number: z.coerce.number().int().min(1),
  duration_seconds: z.coerce.number().int().min(0).optional().nullable(),
});

function estimateReadTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function generateSlug(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
  return base || id.slice(0, 8);
}

const essaySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  status: z.enum(["published", "draft", "archived"]).optional(),
});

// ─── Read — Music Projects ─────────────────────────────────────────────────────

export async function getMusicProjects(): Promise<MusicProject[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("music_projects")
      .select("*, tracks(*)")
      .order("sort_order", { ascending: true });

    if (error || !data) return [];
    return data as MusicProject[];
  } catch {
    return [];
  }
}

export async function getMusicProjectById(id: string): Promise<MusicProject | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("music_projects")
      .select("*, tracks(*)")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as MusicProject;
  } catch {
    return null;
  }
}

// ─── Read — Analysis Essays ────────────────────────────────────────────────────

export async function getAnalysisEssays(): Promise<AnalysisEssay[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("analysis_essays")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as AnalysisEssay[];
  } catch {
    return [];
  }
}

export async function getAnalysisEssayById(id: string): Promise<AnalysisEssay | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("analysis_essays")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as AnalysisEssay;
  } catch {
    return null;
  }
}

// ─── Create — Music Project ────────────────────────────────────────────────────

export async function createMusicProject(
  _prev: StudioActionState,
  formData: FormData
): Promise<StudioActionState> {
  const raw = {
    slug: formData.get("slug"),
    title: formData.get("title"),
    description: formData.get("description") || "",
    release_year: formData.get("release_year") || null,
    is_featured: formData.get("is_featured") === "true",
    is_wip: formData.get("is_wip") === "true",
    status: formData.get("status") || "draft",
    sort_order: formData.get("sort_order") || 0,
  };

  const parsed = musicProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("music_projects")
      .insert({
        ...parsed.data,
        description: parsed.data.description || null,
        release_year: parsed.data.release_year ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    revalidateContent("music");
    return { success: true, id: data.id };
  } catch {
    return { success: false, error: "Failed to create music project" };
  }
}

// ─── Update — Music Project ────────────────────────────────────────────────────

export async function updateMusicProject(
  id: string,
  _prev: StudioActionState,
  formData: FormData
): Promise<StudioActionState> {
  const raw = {
    slug: formData.get("slug"),
    title: formData.get("title"),
    description: formData.get("description") || "",
    release_year: formData.get("release_year") || null,
    is_featured: formData.get("is_featured") === "true",
    is_wip: formData.get("is_wip") === "true",
    status: formData.get("status") || "draft",
    sort_order: formData.get("sort_order") || 0,
  };

  const parsed = musicProjectSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("music_projects")
      .update({
        ...parsed.data,
        description: parsed.data.description || null,
        release_year: parsed.data.release_year ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateContent("music");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update music project" };
  }
}

// ─── Delete — Music Project ────────────────────────────────────────────────────

export async function deleteMusicProject(
  id: string,
  confirmTitle: string
): Promise<StudioActionState> {
  const project = await getMusicProjectById(id);
  if (!project) return { success: false, error: "Project not found" };
  if (project.title !== confirmTitle) {
    return { success: false, error: "Title does not match" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("music_projects").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateContent("music");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete music project" };
  }
}

// ─── Upload — Music Cover ──────────────────────────────────────────────────────

export async function uploadMusicCover(
  projectId: string,
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };

  // Magic-byte validation
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer).slice(0, 4);
  const allowed = [
    [0xff, 0xd8, 0xff],       // JPEG
    [0x89, 0x50, 0x4e, 0x47], // PNG
    [0x52, 0x49, 0x46, 0x46], // WebP (RIFF)
  ];
  const isAllowed = allowed.some((sig) => sig.every((b, i) => bytes[i] === b));
  if (!isAllowed) return { success: false, error: "Only JPEG, PNG, and WebP are supported" };

  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: "File too large (max 5MB)" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;

  try {
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("music-covers")
      .upload(filename, file, { contentType: file.type, upsert: false });

    if (uploadError) return { success: false, error: uploadError.message };

    const { data: urlData } = supabase.storage.from("music-covers").getPublicUrl(filename);

    await supabase
      .from("music_projects")
      .update({ artwork_path: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", projectId);

    revalidateContent("music");
    return { success: true, url: urlData.publicUrl };
  } catch {
    return { success: false, error: "Upload failed" };
  }
}

// ─── Tracks ────────────────────────────────────────────────────────────────────

export async function addTrack(
  projectId: string,
  _prev: StudioActionState,
  formData: FormData
): Promise<StudioActionState> {
  const raw = {
    title: formData.get("title"),
    track_number: formData.get("track_number") || 1,
    duration_seconds: formData.get("duration_seconds") || null,
  };

  const parsed = trackSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tracks")
      .insert({
        music_project_id: projectId,
        ...parsed.data,
        duration_seconds: parsed.data.duration_seconds ?? null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    revalidateContent("music");
    return { success: true, id: data.id };
  } catch {
    return { success: false, error: "Failed to add track" };
  }
}

export async function updateTrack(
  trackId: string,
  _prev: StudioActionState,
  formData: FormData
): Promise<StudioActionState> {
  const raw = {
    title: formData.get("title"),
    track_number: formData.get("track_number") || 1,
    duration_seconds: formData.get("duration_seconds") || null,
  };

  const parsed = trackSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("tracks")
      .update({
        ...parsed.data,
        duration_seconds: parsed.data.duration_seconds ?? null,
      })
      .eq("id", trackId);

    if (error) return { success: false, error: error.message };

    revalidateContent("music");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update track" };
  }
}

export async function deleteTrack(trackId: string): Promise<StudioActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("tracks").delete().eq("id", trackId);
    if (error) return { success: false, error: error.message };
    revalidateContent("music");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete track" };
  }
}

export async function uploadTrackAudio(
  trackId: string,
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };

  // Magic-byte validation for audio files
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer).slice(0, 4);
  const allowedAudio = [
    [0xff, 0xfb],             // MP3 (MPEG sync + Layer 3)
    [0xff, 0xf3],             // MP3 variant
    [0xff, 0xf2],             // MP3 variant
    [0x49, 0x44, 0x33],       // MP3 with ID3 tag
    [0x52, 0x49, 0x46, 0x46], // WAV (RIFF)
    [0x66, 0x4c, 0x61, 0x43], // FLAC (fLaC)
  ];
  const isAllowed = allowedAudio.some((sig) => sig.every((b, i) => bytes[i] === b));
  if (!isAllowed) return { success: false, error: "Only MP3, WAV, and FLAC are supported" };

  if (file.size > 100 * 1024 * 1024) {
    return { success: false, error: "File too large (max 100MB)" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
  const filename = `${crypto.randomUUID()}.${ext}`;

  try {
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("music-audio")
      .upload(filename, file, { contentType: file.type, upsert: false });

    if (uploadError) return { success: false, error: uploadError.message };

    const { data: urlData } = supabase.storage.from("music-audio").getPublicUrl(filename);

    await supabase
      .from("tracks")
      .update({ audio_path: urlData.publicUrl })
      .eq("id", trackId);

    revalidateContent("music");
    return { success: true, url: urlData.publicUrl };
  } catch {
    return { success: false, error: "Upload failed" };
  }
}

// ─── Create — Analysis Essay ───────────────────────────────────────────────────

export async function createAnalysisEssay(
  _prev: StudioActionState,
  formData: FormData
): Promise<StudioActionState> {
  const bodyHtml = (formData.get("body_html") as string) || "";

  const rawTitle = formData.get("title") as string | null;
  const rawSlug = formData.get("slug") as string | null;

  const raw = {
    slug: rawSlug?.trim() || "",
    title: rawTitle?.trim() || "",
    subject: formData.get("subject"),
    status: formData.get("status") || "draft",
  };

  const parsed = essaySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const readTime = bodyHtml ? estimateReadTime(bodyHtml) : null;

  try {
    const supabase = await createClient();

    // If no slug provided, generate from title
    const slug = parsed.data.slug || generateSlug(parsed.data.title, crypto.randomUUID());

    const { data, error } = await supabase
      .from("analysis_essays")
      .insert({
        ...parsed.data,
        slug,
        body_html: bodyHtml || null,
        content: bodyHtml || null,
        read_time_minutes: readTime,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    revalidateContent("music");
    return { success: true, id: data.id };
  } catch {
    return { success: false, error: "Failed to create essay" };
  }
}

// ─── Update — Analysis Essay ───────────────────────────────────────────────────

export async function updateAnalysisEssay(
  id: string,
  _prev: StudioActionState,
  formData: FormData
): Promise<StudioActionState> {
  const bodyHtml = (formData.get("body_html") as string) || "";

  const raw = {
    slug: formData.get("slug"),
    title: formData.get("title"),
    subject: formData.get("subject"),
    status: formData.get("status") || "draft",
  };

  const parsed = essaySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const readTime = bodyHtml ? estimateReadTime(bodyHtml) : null;

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("analysis_essays")
      .update({
        ...parsed.data,
        body_html: bodyHtml || null,
        content: bodyHtml || null,
        read_time_minutes: readTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateContent("music");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update essay" };
  }
}

// ─── Delete — Analysis Essay ───────────────────────────────────────────────────

export async function deleteAnalysisEssay(
  id: string,
  confirmTitle: string
): Promise<StudioActionState> {
  const essay = await getAnalysisEssayById(id);
  if (!essay) return { success: false, error: "Essay not found" };
  if (essay.title !== confirmTitle) {
    return { success: false, error: "Title does not match" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("analysis_essays").delete().eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateContent("music");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete essay" };
  }
}

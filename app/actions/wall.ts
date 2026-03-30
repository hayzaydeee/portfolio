"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { revalidateContent } from "@/lib/revalidate";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WallPiece = {
  id: string;
  type: "art" | "video_short" | "video_long";
  caption: string | null;
  description: string | null;
  image_path: string | null;
  preview_path: string | null;
  youtube_url: string | null;
  duration: string | null;
  alt_text: string | null;
  status: "published" | "draft" | "scheduled" | "hidden";
  publish_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WallActionState = {
  success: boolean;
  error?: string;
  id?: string;
};

// ─── Validation ───────────────────────────────────────────────────────────────

const wallPieceSchema = z.object({
  type: z.enum(["art", "video_short", "video_long"]),
  caption: z.string().max(200).optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  alt_text: z.string().max(300).optional().or(z.literal("")),
  youtube_url: z.string().url().optional().or(z.literal("")),
  duration: z
    .string()
    .regex(/^\d+:\d{2}$/, "Duration must be in MM:SS or HH:MM:SS format")
    .optional()
    .or(z.literal("")),
  status: z.enum(["published", "draft", "scheduled", "hidden"]).optional(),
  publish_at: z.string().datetime({ offset: false }).optional().or(z.literal("")).nullable(),
});

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getWallPieces(): Promise<WallPiece[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wall_pieces")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as WallPiece[];
  } catch {
    return [];
  }
}

export async function getWallPieceById(id: string): Promise<WallPiece | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wall_pieces")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as WallPiece;
  } catch {
    return null;
  }
}

// ─── Create ────────────────────────────────────────────────────────────────────

export async function createWallPiece(
  _prev: WallActionState,
  formData: FormData
): Promise<WallActionState> {
  const publishAtRaw = (formData.get("publish_at") as string) || "";

  const raw = {
    type: formData.get("type"),
    caption: formData.get("caption") || "",
    description: formData.get("description") || "",
    alt_text: formData.get("alt_text") || "",
    youtube_url: formData.get("youtube_url") || "",
    duration: formData.get("duration") || "",
    status: formData.get("status") || "draft",
    publish_at: publishAtRaw || null,
  };

  const parsed = wallPieceSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wall_pieces")
      .insert({
        ...parsed.data,
        caption: parsed.data.caption || null,
        description: parsed.data.description || null,
        alt_text: parsed.data.alt_text || null,
        youtube_url: parsed.data.youtube_url || null,
        duration: parsed.data.duration || null,
        publish_at: parsed.data.publish_at || null,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };

    revalidateContent("wall");
    return { success: true, id: data.id };
  } catch {
    return { success: false, error: "Failed to create wall piece" };
  }
}

// ─── Update ────────────────────────────────────────────────────────────────────

export async function updateWallPiece(
  id: string,
  _prev: WallActionState,
  formData: FormData
): Promise<WallActionState> {
  const publishAtRaw = (formData.get("publish_at") as string) || "";

  const raw = {
    type: formData.get("type"),
    caption: formData.get("caption") || "",
    description: formData.get("description") || "",
    alt_text: formData.get("alt_text") || "",
    youtube_url: formData.get("youtube_url") || "",
    duration: formData.get("duration") || "",
    status: formData.get("status") || "draft",
    publish_at: publishAtRaw || null,
  };

  const parsed = wallPieceSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("wall_pieces")
      .update({
        ...parsed.data,
        caption: parsed.data.caption || null,
        description: parsed.data.description || null,
        alt_text: parsed.data.alt_text || null,
        youtube_url: parsed.data.youtube_url || null,
        duration: parsed.data.duration || null,
        publish_at: parsed.data.publish_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) return { success: false, error: error.message };

    revalidateContent("wall");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update wall piece" };
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────────

export async function deleteWallPiece(id: string): Promise<WallActionState> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("wall_pieces").delete().eq("id", id);
    if (error) return { success: false, error: error.message };
    revalidateContent("wall");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete wall piece" };
  }
}

// ─── Upload — Image ────────────────────────────────────────────────────────────

export async function uploadWallImage(
  pieceId: string,
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

  if (file.size > 10 * 1024 * 1024) {
    return { success: false, error: "File too large (max 10MB)" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;

  try {
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("wall-images")
      .upload(filename, file, { contentType: file.type, upsert: false });

    if (uploadError) return { success: false, error: uploadError.message };

    const { data: urlData } = supabase.storage.from("wall-images").getPublicUrl(filename);

    await supabase
      .from("wall_pieces")
      .update({ image_path: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", pieceId);

    revalidateContent("wall");
    return { success: true, url: urlData.publicUrl };
  } catch {
    return { success: false, error: "Upload failed" };
  }
}

// ─── Upload — Video Preview ────────────────────────────────────────────────────

export async function uploadWallPreview(
  pieceId: string,
  formData: FormData
): Promise<{ success: boolean; url?: string; error?: string }> {
  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };

  // Magic-byte validation for video (MP4/WebM)
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer).slice(0, 12);
  const isMp4 =
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70; // ftyp box
  const isWebM =
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3;

  if (!isMp4 && !isWebM) {
    return { success: false, error: "Only MP4 and WebM video files are supported" };
  }

  if (file.size > 50 * 1024 * 1024) {
    return { success: false, error: "File too large (max 50MB)" };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
  const filename = `${crypto.randomUUID()}.${ext}`;

  try {
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from("wall-videos")
      .upload(filename, file, { contentType: file.type, upsert: false });

    if (uploadError) return { success: false, error: uploadError.message };

    const { data: urlData } = supabase.storage.from("wall-videos").getPublicUrl(filename);

    await supabase
      .from("wall_pieces")
      .update({ preview_path: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", pieceId);

    revalidateContent("wall");
    return { success: true, url: urlData.publicUrl };
  } catch {
    return { success: false, error: "Upload failed" };
  }
}

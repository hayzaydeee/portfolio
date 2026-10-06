import { createPublicClient } from "@/lib/supabase/server";

export type WallPieceType = "art" | "video_short" | "video_long";

export type WallPiece = {
  id: string;
  type: WallPieceType;
  caption: string | null;
  description: string | null;
  image_path: string | null;
  preview_path: string | null;
  youtube_url: string | null;
  duration: string | null;
  alt_text: string | null;
  status: "published" | "scheduled";
  publish_at: string | null;
  created_at: string;
};

export async function getWallPieces(): Promise<WallPiece[]> {
  try {
    const supabase = await createPublicClient();
    const now = new Date().toISOString();

    // Fetch published pieces + scheduled pieces (status = 'scheduled' with publish_at <= now)
    const { data, error } = await supabase
      .from("wall_pieces")
      .select(
        "id, type, caption, description, image_path, preview_path, youtube_url, duration, alt_text, status, publish_at, created_at"
      )
      .or(`status.eq.published,and(status.eq.scheduled,publish_at.lte.${now})`)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as WallPiece[];
  } catch {
    return [];
  }
}

export type SealedPiece = {
  id: string;
  type: WallPieceType;
  publish_at: string;
};

/**
 * Pieces scheduled for the future. Served by a security-definer RPC that returns no media
 * or captions, so a seal can be drawn without leaking what's under it.
 */
export async function getSealedPieces(): Promise<SealedPiece[]> {
  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase.rpc("sealed_wall_pieces");
    if (error || !data) return [];
    return data as SealedPiece[];
  } catch {
    return [];
  }
}

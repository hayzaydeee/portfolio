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

export async function getScheduledPieces(): Promise<WallPiece[]> {
  try {
    const supabase = await createPublicClient();
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("wall_pieces")
      .select("id, publish_at")
      .eq("status", "scheduled")
      .gt("publish_at", now);

    if (error || !data) return [];
    return data as WallPiece[];
  } catch {
    return [];
  }
}



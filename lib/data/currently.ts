import { createPublicClient } from "@/lib/supabase/server";

export type Currently = {
  id: string;
  type: "project" | "music" | "thought" | "film" | "book";
  verb: string;
  content: string;
  link: string | null;
};

export async function getCurrently(): Promise<Currently | null> {
  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("currently")
      .select("id, type, verb, content, link")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data as Currently;
  } catch {
    return null;
  }
}

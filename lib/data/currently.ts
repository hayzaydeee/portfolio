import { createClient } from "@/lib/supabase/server";

export type Currently = {
  id: string;
  type: "project" | "music" | "verse" | "film" | "book";
  verb: string;
  content: string;
  link: string | null;
};

export async function getCurrently(): Promise<Currently | null> {
  try {
    const supabase = await createClient();
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

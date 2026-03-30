import { createPublicClient } from "@/lib/supabase/server";

export type Journal = "reflections" | "fragments" | "annotations" | "responses" | "buildlog";

export type NotebookEntry = {
  id: string;
  slug: string;
  journal: Journal;
  title: string | null;
  body_html: string | null;
  read_time_minutes: number | null;
  tags: string[] | null;
  created_at: string;
  published_at: string | null;
};

export async function getJournalEntries(journal: Journal): Promise<NotebookEntry[]> {
  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("notebook_entries")
      .select("id, slug, journal, title, body_html, read_time_minutes, tags, created_at, published_at")
      .eq("journal", journal)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error || !data) return [];
    return data as NotebookEntry[];
  } catch {
    return [];
  }
}

export async function getEntryBySlug(
  journal: Journal,
  slug: string
): Promise<NotebookEntry | null> {
  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("notebook_entries")
      .select("*")
      .eq("slug", slug)
      .eq("journal", journal)
      .eq("status", "published")
      .single();

    if (error || !data) return null;
    return data as NotebookEntry;
  } catch {
    return null;
  }
}

export async function getAllPublishedEntries(): Promise<
  { slug: string; journal: Journal }[]
> {
  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("notebook_entries")
      .select("slug, journal")
      .eq("status", "published");

    if (error || !data) return [];
    return data as { slug: string; journal: Journal }[];
  } catch {
    return [];
  }
}

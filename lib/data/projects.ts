import { createPublicClient } from "@/lib/supabase/server";

export type FeaturedProject = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  stack: string[];
  repo_url: string | null;
  live_url: string | null;
  thumbnail_url: string | null;
  personal_note: string | null;
  order_index: number;
};

export async function getFeaturedProjects(limit = 3): Promise<FeaturedProject[]> {
  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, slug, title, tagline, stack, repo_url, live_url, thumbnail_url, personal_note, order_index"
      )
      .eq("status", "published")
      .eq("is_featured", true)
      .order("order_index", { ascending: true })
      .limit(limit);

    if (error || !data) return [];
    return data as FeaturedProject[];
  } catch {
    return [];
  }
}

export type PublishedProject = {
  slug: string;
  title: string;
  status: string;
  is_featured: boolean;
  order_index: number;
};

export async function getPublishedProjects(): Promise<PublishedProject[]> {
  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("projects")
      .select("slug, title, status, is_featured, order_index")
      .eq("status", "published")
      .order("order_index", { ascending: true });

    if (error || !data) return [];
    return data as PublishedProject[];
  } catch {
    return [];
  }
}

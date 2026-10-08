import { createPublicClient } from "@/lib/supabase/server";
import { createAnonClient } from "@/lib/supabase/anon";
import type { MusicProject, Track, AnalysisEssay } from "@/app/actions/studio";

export async function getPublishedMusicProjects(): Promise<MusicProject[]> {
  try {
    const supabase = await createPublicClient();
    const { data: projects, error } = await supabase
      .from("music_projects")
      .select("*")
      .eq("status", "published")
      .order("sort_order", { ascending: true });

    if (error || !projects) return [];

    // Fetch tracks for all projects
    const projectIds = projects.map((p) => p.id);
    const { data: tracks } = await supabase
      .from("tracks")
      .select("*")
      .in("music_project_id", projectIds)
      .order("track_number", { ascending: true });

    // Attach tracks to projects
    return projects.map((p) => ({
      ...(p as MusicProject),
      tracks: (tracks ?? []).filter((t: Track) => t.music_project_id === p.id),
    }));
  } catch {
    return [];
  }
}

export async function getWipMusicProjects(): Promise<MusicProject[]> {
  try {
    const supabase = await createPublicClient();
    const { data, error } = await supabase
      .from("music_projects")
      .select("*")
      .eq("is_wip", true)
      .eq("status", "published")
      .order("sort_order", { ascending: true });

    if (error || !data) return [];
    return data as MusicProject[];
  } catch {
    return [];
  }
}

// The essay reads use the cookie-less client: /music/analysis/[slug] is prebuilt from
// getPublishedEssays, and an essay published after a deploy renders on demand, neither of
// which can read cookies
export async function getPublishedEssays(): Promise<AnalysisEssay[]> {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("analysis_essays")
      .select("id, slug, title, subject, read_time_minutes, status, created_at, updated_at")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as AnalysisEssay[];
  } catch {
    return [];
  }
}

export async function getEssayBySlug(slug: string): Promise<AnalysisEssay | null> {
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("analysis_essays")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error || !data) return null;
    return data as AnalysisEssay;
  } catch {
    return null;
  }
}

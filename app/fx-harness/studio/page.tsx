import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { AnalysisEssay, MusicProject, Track } from "@/app/actions/studio";
import { StudioPage } from "@/components/studio/StudioPage";
import { StudioBackdrop } from "@/components/studio/StudioBackdrop";
import { ESSAYS } from "./essays";

/**
 * The studio from fixtures, for Playwright and screenshots without a database: three projects
 * (one with artwork, two drawn), a work in progress and two essays. Every track plays the
 * kick fixture, so the analyser has something to read.
 */

const KICK = "/fx-test/kick.mp3";
const AT = "2026-01-01T00:00:00Z";

function tracks(projectId: string, titles: string[]): Track[] {
  return titles.map((title, i) => ({
    id: `${projectId}-t${i + 1}`,
    music_project_id: projectId,
    title,
    audio_path: KICK,
    duration_seconds: 120 + i * 37,
    track_number: i + 1,
    created_at: AT,
  }));
}

function project(id: string, title: string, year: number, artwork: string | null, trackTitles: string[], extra: Partial<MusicProject> = {}): MusicProject {
  return {
    id,
    slug: id,
    title,
    description: null,
    artwork_path: artwork,
    release_year: year,
    is_featured: false,
    is_wip: false,
    status: "published",
    sort_order: 0,
    created_at: AT,
    updated_at: AT,
    tracks: tracks(id, trackTitles),
    ...extra,
  };
}

export default async function StudioHarness({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  // ?backdrop=0 leaves the room's backdrop out, and with it the player's studio key
  const backdrop = (await searchParams).backdrop !== "0";
  if (process.env.NODE_ENV === "production" && process.env.FX_HARNESS !== "1") notFound();

  const projects: MusicProject[] = [
    project("after-hours", "after hours", 2025, "/fx-test/sleeve.png", ["low light", "second take", "porch"], {
      is_featured: true,
      description: "late sessions, mostly keys and room tone.",
    }),
    project("glasshouse", "glasshouse", 2024, null, ["intro", "glasshouse", "condensation", "outro"]),
    project("northbound", "northbound", 2023, null, ["platform 4", "northbound"]),
  ];
  const wip: MusicProject[] = [project("untitled-sketch", "untitled sketch", 2026, null, [], { is_wip: true })];
  const essays: AnalysisEssay[] = ESSAYS;

  return (
    // isolate: the backdrop's negative z stays above the harness layout's own background
    <main className="relative isolate min-h-screen text-(--studio-text)">
      {backdrop && <StudioBackdrop />}
      <StudioPage projects={projects} wipProjects={wip} essays={essays} featured={projects[0]} />
    </main>
  );
}

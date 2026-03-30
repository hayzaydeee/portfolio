import { getPublishedMusicProjects, getWipMusicProjects, getPublishedEssays } from "@/lib/data/studio";
import { StudioPage } from "@/components/studio/StudioPage";

export default async function MusicPage() {
  const [projects, wipProjects, essays] = await Promise.all([
    getPublishedMusicProjects(),
    getWipMusicProjects(),
    getPublishedEssays(),
  ]);

  // Remove WIP projects from published list
  const publishedNonWip = projects.filter((p) => !p.is_wip);
  const featured = publishedNonWip.find((p) => p.is_featured) ?? publishedNonWip[0] ?? null;

  return (
    <StudioPage
      projects={publishedNonWip}
      wipProjects={wipProjects}
      essays={essays}
      featured={featured}
    />
  );
}

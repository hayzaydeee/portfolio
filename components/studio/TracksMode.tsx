"use client";

import type { MusicProject } from "@/app/actions/studio";
import { HeroSection } from "@/components/studio/HeroSection";
import { ArtistAbout } from "@/components/studio/ArtistAbout";
import { ProjectsGrid } from "@/components/studio/ProjectsGrid";
import { InTheLab } from "@/components/studio/InTheLab";

type Props = {
  projects: MusicProject[];
  wipProjects: MusicProject[];
  featured: MusicProject | null;
};

export function TracksMode({ projects, wipProjects, featured }: Props) {
  return (
    <div>
      {featured && <HeroSection project={featured} />}
      <ArtistAbout projects={projects} />
      <ProjectsGrid projects={projects} />
      <InTheLab projects={wipProjects} />
    </div>
  );
}

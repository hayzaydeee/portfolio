import { getPublishedProjects } from "@/lib/data/projects";
import { getCurrently } from "@/lib/data/currently";
import { getSiteConfig, highlightStackJson } from "@/lib/data/settings";
import { WorkshopClient } from "@/components/workshop/WorkshopClient";

export default async function WorkshopPage() {
  const [projects, currently, config] = await Promise.all([
    getPublishedProjects(),
    getCurrently(),
    getSiteConfig(),
  ]);

  const workshopProjects = projects.map((p) => ({
    name: p.title,
    slug: p.slug,
    isNew: p.is_featured,
  }));

  // Falls back to the static stack in WorkshopClient when unset
  const highlightedStackHtml = config.stackJson
    ? await highlightStackJson(config.stackJson)
    : null;

  return (
    <WorkshopClient
      projects={workshopProjects}
      currently={currently}
      highlightedStackHtml={highlightedStackHtml}
    />
  );
}

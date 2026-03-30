import { getPublishedProjects } from "@/lib/data/projects";
import { getCurrently } from "@/lib/data/currently";
import { getSettings, getHighlightedStackJson } from "@/app/actions/settings";
import { WorkshopClient } from "@/components/workshop/WorkshopClient";

export default async function WorkshopPage() {
  const [projects, currently, settings] = await Promise.all([
    getPublishedProjects(),
    getCurrently(),
    getSettings(),
  ]);

  const workshopProjects = projects.map((p) => ({
    name: p.title,
    slug: p.slug,
    isNew: p.is_featured,
  }));

  let highlightedStackHtml: string | null = null;
  const stackJson = settings?.stack_json ?? null;
  if (stackJson) {
    try {
      highlightedStackHtml = await getHighlightedStackJson(stackJson);
    } catch {
      // fall through to static fallback in client
    }
  }

  return (
    <WorkshopClient
      projects={workshopProjects}
      currently={currently}
      highlightedStackHtml={highlightedStackHtml}
    />
  );
}

import { getPublishedProjects } from "@/lib/data/projects";
import { getCurrently } from "@/lib/data/currently";
import { WorkshopClient } from "@/components/workshop/WorkshopClient";

export default async function WorkshopPage() {
  const [projects, currently] = await Promise.all([
    getPublishedProjects(),
    getCurrently(),
  ]);

  const workshopProjects = projects.map((p) => ({
    name: p.title,
    slug: p.slug,
    isNew: p.is_featured,
  }));

  return <WorkshopClient projects={workshopProjects} currently={currently} />;
}

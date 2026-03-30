import { getMusicProjects, getAnalysisEssays } from "@/app/actions/studio";
import { StudioClient } from "@/components/admin/studio/StudioClient";

export default async function StudioPage() {
  const [projects, essays] = await Promise.all([getMusicProjects(), getAnalysisEssays()]);

  return <StudioClient projects={projects} essays={essays} />;
}

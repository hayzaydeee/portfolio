import { getCurrently } from "@/lib/data/currently";
import { getFeaturedProjects } from "@/lib/data/projects";
import { LobbyPage } from "@/components/lobby/LobbyPage";

export default async function Home() {
  const [currently, projects] = await Promise.all([
    getCurrently(),
    getFeaturedProjects(3),
  ]);

  return <LobbyPage currently={currently} projects={projects} />;
}

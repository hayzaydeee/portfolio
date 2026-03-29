import Link from "next/link";
import { getAllProjects } from "@/app/actions/projects";
import { ProjectsTable } from "@/components/admin/workshop/ProjectsTable";

export default async function WorkshopPage() {
  const projects = await getAllProjects();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-sans text-(--lobby-text)">Workshop</h1>
          <p className="text-sm text-(--color-text-muted) mt-0.5">
            {projects.filter((p) => p.status === "published").length} published ·{" "}
            {projects.length} total
          </p>
        </div>
        <Link
          href="/admin/workshop/new"
          className="text-sm px-4 py-2 border border-(--lobby-text)/20 rounded-lg text-(--lobby-text) hover:bg-white/5 transition-colors"
        >
          New project
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
        <ProjectsTable initialProjects={projects} />
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { getProjectById } from "@/app/actions/projects";
import { ProjectForm } from "@/components/admin/workshop/ProjectForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditProjectPage({ params }: Props) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/workshop"
          className="text-xs text-(--color-text-muted) hover:text-(--lobby-text) transition-colors"
        >
          ← Workshop
        </Link>
        <span className="text-(--color-text-muted)">/</span>
        <h1 className="text-xl font-sans text-(--lobby-text)">{project.title}</h1>
      </div>
      <ProjectForm project={project} />
    </div>
  );
}

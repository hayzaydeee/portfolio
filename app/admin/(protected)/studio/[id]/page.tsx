import { notFound } from "next/navigation";
import Link from "next/link";
import { getMusicProjectById } from "@/app/actions/studio";
import { MusicProjectForm } from "@/components/admin/studio/MusicProjectForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditMusicProjectPage({ params }: Props) {
  const { id } = await params;
  const project = await getMusicProjectById(id);

  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/studio"
          className="text-sm text-text-muted hover:text-(--lobby-text) transition-colors"
        >
          ← Studio
        </Link>
        <span className="text-text-muted opacity-40">/</span>
        <h1 className="text-xl font-sans text-(--lobby-text)">{project.title}</h1>
      </div>

      <MusicProjectForm project={project} />
    </div>
  );
}

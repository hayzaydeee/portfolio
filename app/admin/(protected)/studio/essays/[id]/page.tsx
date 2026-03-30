import { notFound } from "next/navigation";
import Link from "next/link";
import { getAnalysisEssayById } from "@/app/actions/studio";
import { AnalysisEssayForm } from "@/components/admin/studio/AnalysisEssayForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAnalysisEssayPage({ params }: Props) {
  const { id } = await params;
  const essay = await getAnalysisEssayById(id);

  if (!essay) notFound();

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
        <h1 className="text-xl font-sans text-(--lobby-text)">{essay.title}</h1>
      </div>

      <AnalysisEssayForm essay={essay} />
    </div>
  );
}

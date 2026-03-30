import { notFound } from "next/navigation";
import Link from "next/link";
import { getWallPieceById } from "@/app/actions/wall";
import { WallPieceForm } from "@/components/admin/wall/WallPieceForm";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditWallPiecePage({ params }: Props) {
  const { id } = await params;
  const piece = await getWallPieceById(id);

  if (!piece) notFound();

  const caption = piece.caption ?? `${piece.type} piece`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/wall"
          className="text-sm text-text-muted hover:text-(--lobby-text) transition-colors"
        >
          ← Wall
        </Link>
        <span className="text-text-muted opacity-40">/</span>
        <h1 className="text-xl font-sans text-(--lobby-text)">{caption}</h1>
      </div>

      <WallPieceForm piece={piece} />
    </div>
  );
}

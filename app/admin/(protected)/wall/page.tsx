import Link from "next/link";
import { getWallPieces } from "@/app/actions/wall";
import { WallPiecesTable } from "@/components/admin/wall/WallPiecesTable";

export default async function WallPage() {
  const pieces = await getWallPieces();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-sans text-(--lobby-text)">Wall</h1>
          <p className="text-sm text-text-muted mt-0.5">Art, short video, and long video pieces</p>
        </div>
        <Link
          href="/admin/wall/new"
          className="text-sm px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
        >
          New piece
        </Link>
      </div>

      <WallPiecesTable pieces={pieces} />
    </div>
  );
}

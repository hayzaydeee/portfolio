import Link from "next/link";
import { WallPieceForm } from "@/components/admin/wall/WallPieceForm";

export default function NewWallPiecePage() {
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
        <h1 className="text-xl font-sans text-(--lobby-text)">New wall piece</h1>
      </div>

      <WallPieceForm />
    </div>
  );
}

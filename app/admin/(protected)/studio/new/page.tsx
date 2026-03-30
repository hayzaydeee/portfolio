import Link from "next/link";
import { MusicProjectForm } from "@/components/admin/studio/MusicProjectForm";

export default function NewMusicProjectPage() {
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
        <h1 className="text-xl font-sans text-(--lobby-text)">New music project</h1>
      </div>

      <MusicProjectForm />
    </div>
  );
}

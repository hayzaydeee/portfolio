import { notFound } from "next/navigation";
import Link from "next/link";
import { getEntryById } from "@/app/actions/notebook";
import { EntryForm } from "@/components/admin/notebook/EntryForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditEntryPage({ params }: Props) {
  const { id } = await params;
  const entry = await getEntryById(id);
  if (!entry) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/notebook"
          className="text-xs text-(--color-text-muted) hover:text-(--lobby-text) transition-colors"
        >
          ← Notebook
        </Link>
        <span className="text-(--color-text-muted)">/</span>
        <h1 className="text-xl font-sans text-(--lobby-text)">
          {entry.title ?? <em className="text-(--color-text-muted)">untitled</em>}
        </h1>
      </div>
      <EntryForm entry={entry} />
    </div>
  );
}

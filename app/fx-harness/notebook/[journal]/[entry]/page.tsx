import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isJournal } from "@/lib/notebook/journals";
import { entryHtml } from "@/lib/notebook/entryHtml";
import { EntryPage } from "@/components/notebook/EntryPage";
import { ENTRY_FIXTURE } from "../../entries";

type Props = { params: Promise<{ journal: string; entry: string }> };

/**
 * One entry from fixtures, through the same server-side sanitizing as the real route, with its
 * page turn going between the harness's own entries.
 */
export default async function EntryHarness({ params }: Props) {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.FX_HARNESS !== "1") notFound();
  const { journal, entry } = await params;
  if (!isJournal(journal)) notFound();
  const list = ENTRY_FIXTURE[journal];
  const idx = list.findIndex((e) => e.slug === entry);
  if (idx < 0) notFound();
  const data = list[idx];
  return (
    <div className="min-h-screen bg-(--notebook-surface) text-(--notebook-text)">
      <EntryPage
        journal={journal}
        entry={{ slug: data.slug, title: data.untitled ? null : data.title, date: data.date, readTime: data.readTime, tags: data.tags }}
        html={entryHtml(data.body)}
        older={list[idx + 1] ?? null}
        newer={list[idx - 1] ?? null}
        base="/fx-harness/notebook"
      />
    </div>
  );
}

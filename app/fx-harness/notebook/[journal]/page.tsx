import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isJournal } from "@/lib/notebook/journals";
import { JournalList } from "@/components/notebook/JournalList";
import { ENTRY_FIXTURE } from "../entries";

type Props = { params: Promise<{ journal: string }> };

/** One journal's page from fixtures: its noren, its copy and its entries */
export default async function JournalHarness({ params }: Props) {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.FX_HARNESS !== "1") notFound();
  const { journal } = await params;
  if (!isJournal(journal)) notFound();
  const entries = ENTRY_FIXTURE[journal].map(({ slug, title, untitled, date, readTime, tags }) => ({ slug, title, untitled, date, readTime, tags }));
  return (
    <div className="min-h-screen bg-(--notebook-surface) text-(--notebook-text)">
      <JournalList journal={journal} entries={entries} />
    </div>
  );
}

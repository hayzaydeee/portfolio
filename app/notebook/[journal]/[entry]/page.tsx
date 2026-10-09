import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getEntryBySlug,
  getAllPublishedEntries,
  getJournalEntries,
} from "@/lib/data/notebook";
import { isJournal } from "@/lib/notebook/journals";
import { EntryPage } from "@/components/notebook/EntryPage";

type Props = { params: Promise<{ journal: string; entry: string }> };

export async function generateStaticParams() {
  const entries = await getAllPublishedEntries();
  return entries.map(({ journal, slug }) => ({ journal, entry: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { journal, entry } = await params;
  if (!isJournal(journal)) return {};
  const data = await getEntryBySlug(journal, entry);
  if (!data) return {};
  return {
    title: data.title
      ? `${data.title} — Notebook`
      : `Entry — Notebook`,
    description: data.body_html
      ? data.body_html.replace(/<[^>]+>/g, "").slice(0, 155)
      : undefined,
  };
}

export default async function EntryRoute({ params }: Props) {
  const { journal, entry } = await params;
  if (!isJournal(journal)) notFound();

  const [data, allEntries] = await Promise.all([
    getEntryBySlug(journal, entry),
    getJournalEntries(journal),
  ]);

  if (!data) notFound();

  // Build prev/next slugs for PageCurl navigation
  const idx = allEntries.findIndex((e) => e.slug === data.slug);
  const prevEntry = idx < allEntries.length - 1 ? allEntries[idx + 1] : null;
  const nextEntry = idx > 0 ? allEntries[idx - 1] : null;

  return (
    <EntryPage
      entry={data}
      journal={journal}
      prevSlug={prevEntry?.slug ?? null}
      nextSlug={nextEntry?.slug ?? null}
    />
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllPublishedEntries, getEntryBySlug, getNeighbours, openingWords } from "@/lib/data/notebook";
import { isJournal } from "@/lib/notebook/journals";
import { entryHtml } from "@/lib/notebook/entryHtml";
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
    title: data.title ? `${data.title} — Notebook` : `Entry — Notebook`,
    description: openingWords(data.body_html, 155) || undefined,
  };
}

export default async function EntryRoute({ params }: Props) {
  const { journal, entry } = await params;
  if (!isJournal(journal)) notFound();

  const [data, { older, newer }] = await Promise.all([getEntryBySlug(journal, entry), getNeighbours(journal, entry)]);
  if (!data) notFound();

  return (
    <EntryPage
      journal={journal}
      entry={{
        slug: data.slug,
        title: data.title?.trim() || null,
        date: data.published_at ?? data.created_at,
        readTime: data.read_time_minutes,
        tags: data.tags ?? [],
      }}
      html={entryHtml(data.body_html)}
      older={older}
      newer={newer}
    />
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getJournalList } from "@/lib/data/notebook";
import { JOURNAL_IDS, isJournal, journalInfo } from "@/lib/notebook/journals";
import { JournalList } from "@/components/notebook/JournalList";

type Props = { params: Promise<{ journal: string }> };

export function generateStaticParams() {
  return JOURNAL_IDS.map((journal) => ({ journal }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { journal } = await params;
  if (!isJournal(journal)) return {};
  const meta = journalInfo(journal);
  return {
    title: `${meta.label} — Notebook`,
    description: meta.description,
  };
}

export default async function JournalPage({ params }: Props) {
  const { journal } = await params;
  if (!isJournal(journal)) notFound();

  const entries = await getJournalList(journal);
  return <JournalList journal={journal} entries={entries} />;
}

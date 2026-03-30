import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Journal } from "@/lib/data/notebook";
import { getJournalEntries } from "@/lib/data/notebook";
import { JournalList } from "@/components/notebook/JournalList";

const JOURNAL_META: Record<Journal, { label: string; description: string }> = {
  reflections: {
    label: "Reflections",
    description: "Long-form essays on faith, life, and what I notice.",
  },
  fragments: {
    label: "Fragments",
    description: "Short observations. Quick and conclusive.",
  },
  annotations: {
    label: "Annotations",
    description: "Scripture, theology, and the margins.",
  },
  responses: {
    label: "Responses",
    description: "Film, music, and creative acts.",
  },
  buildlog: {
    label: "Build log",
    description: "Software and building, thinking in progress.",
  },
};

const VALID_JOURNALS = new Set<string>([
  "reflections",
  "fragments",
  "annotations",
  "responses",
  "buildlog",
]);

type Props = { params: Promise<{ journal: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { journal } = await params;
  if (!VALID_JOURNALS.has(journal)) return {};
  const meta = JOURNAL_META[journal as Journal];
  return {
    title: `${meta.label} — Notebook`,
    description: meta.description,
  };
}

export default async function JournalPage({ params }: Props) {
  const { journal } = await params;
  if (!VALID_JOURNALS.has(journal)) notFound();

  const entries = await getJournalEntries(journal as Journal);
  const meta = JOURNAL_META[journal as Journal];

  return (
    <JournalList
      journal={journal as Journal}
      label={meta.label}
      description={meta.description}
      entries={entries}
    />
  );
}

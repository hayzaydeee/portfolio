import Link from "next/link";
import { cn } from "@/lib/utils";
import { openingWords, type ShelfEntry } from "@/lib/data/notebook";
import { journalInfo, type Journal } from "@/lib/notebook/journals";
import { formatEntryDate, formatReadTime } from "@/lib/notebook/format";
import { JOURNAL_SWATCH } from "./journalTone";
import { EntryPlate } from "./EntryPlate";
import { PageCurl } from "./PageCurl";

export type EntryHead = { slug: string; title: string | null; date: string; readTime: number | null; tags: string[] };

const PROSE: Record<Journal, string> = {
  reflections: "prose-notebook",
  fragments: "prose-notebook prose-notebook--fragments",
  annotations: "prose-notebook",
  responses: "prose-notebook",
  buildlog: "prose-notebook prose-notebook--buildlog",
  cookbook: "prose-notebook prose-notebook--cookbook",
};

/** What drifts behind a build log entry */
const CODE_GLYPHS = "{}[]()<>=/;:+-*&|!?#$_.,01";

/** The entry's own letters, for a drift plate: its title and its opening words */
function letters(title: string | null, html: string) {
  return Array.from(new Set(Array.from(`${title ?? ""}${openingWords(html, 240)}`).filter((c) => /\p{L}|\p{N}/u.test(c)))).join("");
}

/**
 * One entry, rendered on the server from HTML already sanitized there. Its plate and the page
 * turn to its neighbours are the only islands.
 */
export function EntryPage({
  journal,
  entry,
  html,
  older,
  newer,
  base = "/notebook",
}: {
  journal: Journal;
  entry: EntryHead;
  html: string;
  older: ShelfEntry | null;
  newer: ShelfEntry | null;
  /** Where the notebook lives (the harness serves its fixtures under its own path) */
  base?: string;
}) {
  const info = journalInfo(journal);
  const date = formatEntryDate(entry.date);
  const readTime = formatReadTime(entry.readTime);

  return (
    <main className="mx-auto max-w-2xl px-6 pt-28 pb-32" data-entry-page="">
      <nav aria-label="Breadcrumb" className="mb-8 flex items-center justify-between">
        <Link href={`${base}/${journal}`} className="font-mono text-xs text-(--notebook-text-muted) hover:text-(--notebook-text) hover:underline">
          ← {info.label}
        </Link>
        <span className="flex items-center gap-2 font-mono text-xs text-(--notebook-text-muted)">
          <span className={cn("size-2 rounded-sm", JOURNAL_SWATCH[journal])} aria-hidden="true" />
          volume {info.roman}
        </span>
      </nav>

      <EntryPlate journal={journal} slug={entry.slug} glyphs={journal === "buildlog" ? CODE_GLYPHS : letters(entry.title, html)}>
        <header>
          <p className="font-script text-base text-(--notebook-text-muted)">
            <time dateTime={entry.date}>{date}</time>
            {readTime && <span className="ml-3 font-mono text-xs">{readTime}</span>}
          </p>
          {entry.title ? (
            <h1 className="mt-3 font-serif text-3xl leading-snug text-(--notebook-text)">{entry.title}</h1>
          ) : (
            <h1 className="sr-only">
              {info.label}, {date}
            </h1>
          )}
        </header>
      </EntryPlate>

      <article className={PROSE[journal]} dangerouslySetInnerHTML={{ __html: html }} />

      {entry.tags.length > 0 && (
        <ul className="mt-12 flex flex-wrap gap-2 border-t border-(--notebook-border) pt-6" aria-label="Tags">
          {entry.tags.map((tag) => (
            <li key={tag} className="rounded-sm bg-(--notebook-text)/6 px-2 py-0.5 font-mono text-[11px] text-(--notebook-text-muted)">
              {tag}
            </li>
          ))}
        </ul>
      )}

      <PageCurl journal={journal} older={older} newer={newer} base={base} />
    </main>
  );
}

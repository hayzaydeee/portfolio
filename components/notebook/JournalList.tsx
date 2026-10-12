import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ListEntry } from "@/lib/data/notebook";
import { journalInfo, type Journal } from "@/lib/notebook/journals";
import { countLabel, formatEntryDate, formatMonthYear, formatReadTime } from "@/lib/notebook/format";
import { JOURNAL_DECOR, JOURNAL_INK, JOURNAL_SWATCH } from "./journalTone";
import { Noren } from "./Noren";

/**
 * One journal: its noren hung across the top, its name and copy, then every entry, newest first.
 * Rendered on the server; the noren is the only island.
 */
export function JournalList({ journal, entries }: { journal: Journal; entries: ListEntry[] }) {
  const info = journalInfo(journal);
  const since = entries.length ? entries[entries.length - 1].date : null;

  return (
    <main className="mx-auto max-w-4xl px-6 pt-28 pb-24" data-journal={journal}>
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link href="/notebook" className="font-mono text-xs text-(--notebook-text-muted) hover:text-(--notebook-text) hover:underline">
          ← the desk
        </Link>
      </nav>

      <Noren journal={journal} />

      <header className="mx-auto mt-8 max-w-2xl">
        <p className="font-mono text-[10px] tracking-widest text-(--notebook-text-muted) uppercase">
          volume {info.roman} · {info.short}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span className={cn("size-3 shrink-0 rounded-sm", JOURNAL_SWATCH[journal])} aria-hidden="true" />
          <h1 className="font-serif text-4xl leading-tight text-(--notebook-text)">{info.label}</h1>
        </div>
        <p className="mt-2 text-sm text-(--notebook-text-muted)">{info.description}</p>
        <p className="mt-3 font-mono text-[11px] tracking-wider text-(--notebook-text-muted) uppercase">
          {countLabel(entries.length)}
          {since && ` · kept since ${formatMonthYear(since)}`}
        </p>
      </header>

      <section aria-label="Entries" className="mx-auto mt-10 max-w-2xl">
        {entries.length === 0 ? (
          <p className="py-8 text-center font-mono text-sm text-(--notebook-text-muted)">Nothing here yet.</p>
        ) : (
          <ol className="border-t border-(--notebook-border)" data-journal-entries="">
            {entries.map((entry, i) => (
              <li key={entry.slug} className="list-rise border-b border-(--notebook-border)" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <Link href={`/notebook/${journal}/${entry.slug}`} className="group block py-5">
                  <span className="flex items-baseline justify-between gap-4">
                    <span
                      className={cn(
                        "min-w-0 flex-1 font-serif text-lg text-(--notebook-text) decoration-1 underline-offset-4 group-hover:underline",
                        JOURNAL_DECOR[journal],
                        entry.untitled && "truncate italic"
                      )}
                    >
                      {entry.title}
                    </span>
                    <span className={cn("shrink-0 text-sm opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100", JOURNAL_INK[journal])} aria-hidden="true">
                      →
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-3 font-mono text-xs text-(--notebook-text-muted)">
                    <time dateTime={entry.date}>{formatEntryDate(entry.date)}</time>
                    {formatReadTime(entry.readTime) && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{formatReadTime(entry.readTime)}</span>
                      </>
                    )}
                  </span>
                  {entry.tags.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="rounded-sm bg-(--notebook-text)/6 px-1.5 py-0.5 font-mono text-[10px] text-(--notebook-text-muted)">
                          {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

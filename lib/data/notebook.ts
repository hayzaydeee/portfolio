import { createAnonClient } from "@/lib/supabase/anon";
import { JOURNAL_IDS, type Journal } from "@/lib/notebook/journals";

export type { Journal };

export type NotebookEntry = {
  id: string;
  slug: string;
  journal: Journal;
  title: string | null;
  body_html: string | null;
  read_time_minutes: number | null;
  tags: string[] | null;
  created_at: string;
  published_at: string | null;
};

/** One entry as the shelf prints it on a page */
export type ShelfEntry = {
  slug: string;
  /** The title, or the opening words of an untitled entry */
  title: string;
  untitled: boolean;
  date: string;
  readTime: number | null;
};

export type ShelfJournal = {
  journal: Journal;
  count: number;
  /** Newest first, at most SHELF_LATEST */
  latest: ShelfEntry[];
  /** Date of the first entry, for the colophon */
  since: string | null;
};

/** Pages in a shelf volume that carry an entry (its first and last pages are the title and colophon) */
export const SHELF_LATEST = 6;

// Notebook reads go through the cookie-less anon client: row-level security already limits
// them to published rows, and reading no cookies keeps the routes static (prebuilt, then
// revalidated on publish) instead of turning a static page dynamic at request time.

export async function getJournalEntries(journal: Journal): Promise<NotebookEntry[]> {
  try {
    const { data, error } = await createAnonClient()
      .from("notebook_entries")
      .select("id, slug, journal, title, body_html, read_time_minutes, tags, created_at, published_at")
      .eq("journal", journal)
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error || !data) return [];
    return data as NotebookEntry[];
  } catch {
    return [];
  }
}

export async function getEntryBySlug(journal: Journal, slug: string): Promise<NotebookEntry | null> {
  try {
    const { data, error } = await createAnonClient()
      .from("notebook_entries")
      .select("*")
      .eq("slug", slug)
      .eq("journal", journal)
      .eq("status", "published")
      .single();

    if (error || !data) return null;
    return data as NotebookEntry;
  } catch {
    return null;
  }
}

export async function getAllPublishedEntries(): Promise<{ slug: string; journal: Journal }[]> {
  try {
    const { data, error } = await createAnonClient()
      .from("notebook_entries")
      .select("slug, journal")
      .eq("status", "published");

    if (error || !data) return [];
    return data as { slug: string; journal: Journal }[];
  } catch {
    return [];
  }
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** The opening words of an entry's HTML, for an untitled entry's line on a page */
export function openingWords(html: string | null, max = 64): string {
  const text = (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (m, code: string) => {
      if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? m;
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      // fromCodePoint throws past U+10FFFF; surrogates alone aren't characters either
      return n >= 0 && n <= 0x10ffff && (n < 0xd800 || n > 0xdfff) ? String.fromCodePoint(n) : m;
    })
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * The desk's shelf: every journal's count, its latest few entries and when it began. Two
 * reads: every published entry's light columns, then the bodies of just the untitled ones
 * the shelf prints, for their opening words.
 */
export async function getShelf(): Promise<ShelfJournal[]> {
  type Row = { id: string; slug: string; journal: Journal; title: string | null; read_time_minutes: number | null; created_at: string; published_at: string | null };
  let rows: Row[] = [];
  const bodies = new Map<string, string | null>();
  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase
      .from("notebook_entries")
      .select("id, slug, journal, title, read_time_minutes, created_at, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (!error && data) rows = data as Row[];

    const untitled = JOURNAL_IDS.flatMap((j) =>
      rows
        .filter((r) => r.journal === j)
        .slice(0, SHELF_LATEST)
        .filter((r) => !r.title?.trim())
        .map((r) => r.id)
    );
    if (untitled.length) {
      const { data: bodyRows } = await supabase.from("notebook_entries").select("id, body_html").in("id", untitled);
      for (const b of (bodyRows ?? []) as { id: string; body_html: string | null }[]) bodies.set(b.id, b.body_html);
    }
  } catch {
    // An unreachable database shows six empty journals rather than no desk
  }

  return JOURNAL_IDS.map((journal) => {
    const mine = rows.filter((r) => r.journal === journal);
    const dateOf = (r: Row) => r.published_at ?? r.created_at;
    return {
      journal,
      count: mine.length,
      latest: mine.slice(0, SHELF_LATEST).map((r) => {
        const title = r.title?.trim();
        return {
          slug: r.slug,
          title: title || openingWords(bodies.get(r.id) ?? null) || "Untitled entry",
          untitled: !title,
          date: dateOf(r),
          readTime: r.read_time_minutes,
        };
      }),
      since: mine.length ? dateOf(mine[mine.length - 1]) : null,
    };
  });
}

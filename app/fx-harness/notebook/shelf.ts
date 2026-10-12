import type { ShelfJournal } from "@/lib/data/notebook";

/**
 * The desk's fixture shelf: five journals with entries (fragments untitled, as they are on the
 * site) and an empty cookbook. Kept out of page.tsx, which may only export the page.
 */

const day = (n: number) => new Date(Date.UTC(2026, 2, 28 - n * 6)).toISOString();

function journal(id: ShelfJournal["journal"], titles: (string | null)[], count = titles.length): ShelfJournal {
  return {
    journal: id,
    count,
    latest: titles.slice(0, 6).map((title, i) => ({
      slug: `${id}-${i + 1}`,
      title: title ?? "the train was late again and nobody minded, which is its own kind of grace",
      untitled: title === null,
      date: day(i),
      readTime: title === null ? null : 3 + i * 2,
    })),
    since: titles.length ? day(count + 4) : null,
  };
}

export const SHELF_FIXTURE: ShelfJournal[] = [
  journal("reflections", ["on staying", "the long obedience", "what the city taught me", "sabbath, again", "notes on noticing", "a year of small things"], 14),
  journal("fragments", [null, null, null, null], 22),
  journal("annotations", ["psalm 46 in a loud week", "ecclesiastes and the inbox", "the margins of mark"], 3),
  journal("responses", ["after the credits", "on listening twice"], 2),
  journal("buildlog", ["shipping the shelf", "a renderer that waits", "notes on leases", "the portal, again", "why the cloth refuses"], 9),
  journal("cookbook", []),
];

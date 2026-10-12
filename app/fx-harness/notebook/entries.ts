import type { ListEntry } from "@/lib/data/notebook";
import type { Journal } from "@/lib/notebook/journals";
import { SHELF_FIXTURE } from "./shelf";

/**
 * Whole entries for the journal and entry harnesses, built on the shelf's fixtures so the desk,
 * a journal and an entry agree. Bodies are raw HTML as the editor stores it: one carries a
 * script and an inline handler (the server has to strip both), one a code line wider than the
 * column (a sideways scroll there must stay a scroll).
 */

export type FixtureEntry = ListEntry & { body: string };

const para = (seed: string, n: number) =>
  Array.from(
    { length: n },
    (_, i) =>
      `<p>${seed} ${["The light came in low and stayed.", "Nothing was asked of the afternoon, and it gave anyway.", "I wrote it down before it could become a story.", "There is a kind of attention that is close to prayer.", "We kept walking until the street ran out."][i % 5]} ${"It was enough to notice it. ".repeat(3)}</p>`
  ).join("");

const BODIES: Partial<Record<Journal, (i: number) => string>> = {
  fragments: (i) =>
    `<p>${["the train was late again and nobody minded, which is its own kind of grace", "a neighbour's radio through the wall, the same hymn twice", "rain on the skylight like someone counting", "the kettle knows before I do"][i % 4]}.</p><p>${"Small things, kept. ".repeat(4)}</p>`,
  annotations: (i) =>
    `<blockquote><p>Be still, and know that I am God.</p></blockquote>${para("On the margins:", 3 + i)}${
      i === 0 ? `<p>An inline image that should lose its handler <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onerror="window.__xss=1" alt=""></p><script>window.__xss=2</script>` : ""
    }`,
  buildlog: (i) =>
    `${para("Today:", 2)}<pre><code>${i === 0 ? "const shelf = volumes.map((v, i) => buildBook(renderer, shared, lookFor(v, i), fonts, SIZES[i % SIZES.length], i, shadowDark)); // a line wider than the column, which scrolls sideways inside its block" : "await renderer.compileAsync(scene, camera);"}</code></pre>${para("Then:", 2)}`,
};

function entries(journal: Journal): FixtureEntry[] {
  const shelf = SHELF_FIXTURE.find((s) => s.journal === journal);
  if (!shelf) return [];
  const body = BODIES[journal] ?? ((i: number) => para("", 4 + i));
  return shelf.latest.map((e, i) => ({ ...e, tags: i === 0 ? ["first", journal] : [], body: body(i) }));
}

export const ENTRY_FIXTURE: Record<Journal, FixtureEntry[]> = {
  reflections: entries("reflections"),
  fragments: entries("fragments"),
  annotations: entries("annotations"),
  responses: entries("responses"),
  buildlog: entries("buildlog"),
  cookbook: entries("cookbook"),
};

import type { ShelfJournal } from "@/lib/data/notebook";
import type { BookshelfOptions } from "@/components/fx/effects/bookshelf/meta";
import { Shelf } from "./Shelf";

/**
 * The notebook's desk: the six journals on a shelf, the journals' names woven on a sheet
 * that hangs from six pegs on the wall above them, and the same shelf as a list of links.
 */
export function JournalDesk({ shelf, shelfOptions }: { shelf: ShelfJournal[]; shelfOptions?: Partial<BookshelfOptions> }) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="desk-grain pointer-events-none absolute inset-0 opacity-30" aria-hidden="true" />

      {/* Clears the floating dock */}
      <div className="h-20" aria-hidden="true" />

      <header className="relative z-10 flex flex-col items-center px-6">
        <h1 className="font-mono text-xs tracking-widest text-(--notebook-text-muted) uppercase">notebook</h1>
        <p className="mt-1 text-center font-serif text-lg text-(--notebook-text)">six journals, kept by hand</p>
      </header>

      <div className="relative z-10">
        <Shelf shelf={shelf} options={shelfOptions} />
      </div>
    </main>
  );
}

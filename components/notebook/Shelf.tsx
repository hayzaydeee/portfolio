"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { FxStage, type FxHandle, type StageStatus } from "@/components/fx/FxStage";
import { CircleButton } from "@/components/fx/ui/CircleButton";
import { Cta } from "@/components/fx/ui/Cta";
import type { BookshelfOptions, ShelfEvent, ShelfVolume } from "@/components/fx/effects/bookshelf/meta";
import type { ShelfJournal } from "@/lib/data/notebook";
import { journalInfo } from "@/lib/notebook/journals";
import { countLabel, formatEntryDate, formatMonthYear, formatReadTime } from "@/lib/notebook/format";
import { ClothHeading } from "./ClothHeading";
import { JOURNAL_INK, JOURNAL_SWATCH } from "./journalTone";

type Mode = "shelf" | "opening" | "detail" | "closing";
type BookState = { open: boolean; page: number; spreads: number };

/** What a spread shows, for the page counter and the announcement */
function spreadLabel(journal: ShelfJournal, page: number, spreads: number) {
  if (page === 0) return "the title page";
  if (page === spreads - 1) return "the colophon";
  const names = [journal.latest[page * 2 - 2], journal.latest[page * 2 - 1]].filter(Boolean).map((e) => e.title);
  return names.length ? names.join(" and ") : "blank pages";
}

/**
 * The desk's shelf: the six journals as volumes (`effects/bookshelf`) with every control as
 * real DOM, and the cloth banner hung on the wall above them. Browsing, a volume taken down,
 * its cover and pages are all reachable by keyboard and announced; the list of journals below
 * is the same shelf as links, and moving through it turns the shelf to match. A click on a
 * printed entry in an open volume goes to that entry.
 */
export function Shelf({ shelf, options }: { shelf: ShelfJournal[]; options?: Partial<BookshelfOptions> }) {
  const router = useRouter();
  const fx = useRef<FxHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const [status, setStatus] = useState<StageStatus | "disabled">("poster");
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(-1);
  const [mode, setMode] = useState<Mode>("shelf");
  const [book, setBook] = useState<BookState>({ open: false, page: 0, spreads: 5 });
  const [announce, setAnnounce] = useState("");

  const live = status === "live";
  const current = shelf[selected] ?? shelf[0];
  const info = journalInfo(current.journal);

  const volumes = useMemo<ShelfVolume[]>(
    () =>
      shelf.map((s) => {
        const j = journalInfo(s.journal);
        return {
          id: s.journal,
          title: j.label,
          short: j.short,
          roman: j.roman,
          color: `notebook-${s.journal}`,
          countLabel: countLabel(s.count),
          since: s.since ? `kept since ${formatMonthYear(s.since)}` : null,
          entries: s.latest.map((e) => ({
            title: e.title,
            date: formatEntryDate(e.date),
            readTime: formatReadTime(e.readTime),
            untitled: e.untitled,
          })),
        };
      }),
    [shelf]
  );

  // The renderer sets the volume left of the panel on a wide stage; below lg the panel sits under the stage
  const [panelLeft, setPanelLeft] = useState<number | null>(null);
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  // What the shelf needs whichever instance is live (a rebuilt one after a lost context too)
  const setup = useMemo(() => ({ volumes, surface, panel: panelLeft }), [volumes, surface, panelLeft]);

  useEffect(() => {
    const stage = stageRef.current;
    const panel = panelRef.current;
    if (!stage || !panel) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const send = () => {
      setPanelLeft(wide.matches ? Math.round(panel.getBoundingClientRect().left - stage.getBoundingClientRect().left) : null);
    };
    const ro = new ResizeObserver(send);
    ro.observe(stage);
    ro.observe(panel);
    wide.addEventListener("change", send);
    send();
    return () => {
      ro.disconnect();
      wide.removeEventListener("change", send);
    };
  }, []);

  const focusVisible = (selector: string) => {
    const el = [...(wrapRef.current?.querySelectorAll<HTMLElement>(selector) ?? [])].find((n) => n.offsetParent !== null);
    el?.focus({ preventScroll: true });
  };

  // Everything the renderer reports arrives as one event type from its canvas
  const stateRef = useRef({ shelf, selected, book });
  useEffect(() => {
    stateRef.current = { shelf, selected, book };
  });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onShelf = (e: Event) => {
      const detail = (e as CustomEvent<ShelfEvent>).detail;
      const s = stateRef.current;
      const journal = s.shelf[s.selected] ?? s.shelf[0];
      const label = journalInfo(journal.journal).label;
      switch (detail.type) {
        case "select":
          setSelected(detail.index);
          break;
        case "hover":
          setHovered(detail.index);
          break;
        case "mode":
          setMode(detail.mode);
          // A volume back on the shelf is closed, including one whose stage was rebuilt (a lost context) while it was out
          if (detail.mode === "shelf") setBook((b) => ({ ...b, open: false, page: 0 }));
          if (detail.mode === "opening") setAnnounce(`Taking down ${label}.`);
          else if (detail.mode === "detail") setAnnounce(`${label} is out. Open the book, or drag its cover.`);
          else if (detail.mode === "closing") setAnnounce(`Putting ${label} back.`);
          else if (detail.mode === "shelf" && returnFocus.current) setAnnounce(`${label} is back on the shelf.`);
          break;
        case "book": {
          const was = s.book;
          setBook({ open: detail.open, page: detail.page, spreads: detail.spreads });
          if (detail.open && !was.open) setAnnounce(`${label} is open at the title page.`);
          else if (!detail.open && was.open) setAnnounce(`${label} is closed.`);
          else if (detail.open && detail.page !== was.page)
            setAnnounce(`Page ${detail.page + 1} of ${detail.spreads}: ${spreadLabel(journal, detail.page, detail.spreads)}.`);
          break;
        }
        case "entry": {
          const entry = journal.latest[detail.index];
          if (entry) router.push(`/notebook/${journal.journal}/${entry.slug}`);
          break;
        }
      }
    };
    el.addEventListener("fx:shelf", onShelf);
    return () => el.removeEventListener("fx:shelf", onShelf);
  }, [router]);

  // Focus moves once the mode has committed, when the controls it lands on are no longer inert:
  // to the book's toggle when a volume is out, and back to whatever took it down when it's home
  const wasOut = useRef(false);
  useEffect(() => {
    if (mode === "detail") {
      wasOut.current = true;
      focusVisible("[data-shelf-toggle] button");
    } else if (mode === "shelf" && wasOut.current) {
      wasOut.current = false;
      const back = returnFocus.current;
      returnFocus.current = null;
      if (back?.isConnected && back.offsetParent !== null && !back.closest("[inert]")) back.focus({ preventScroll: true });
      // Taken down by a click on the shelf itself: focus was on the volume's controls, now inert
      else if (document.activeElement === document.body || document.activeElement?.closest("[inert]")) focusVisible("[data-shelf-inspect] button");
    }
  }, [mode]);

  const command = (name: string, arg?: unknown) => fx.current?.command(name, arg);

  const inspect = () => {
    returnFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    command("inspect");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!live || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest("input, textarea, select")) return;
    if (mode === "shelf" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      command("step", e.key === "ArrowLeft" ? -1 : 1);
    } else if (mode === "detail" && e.key === "Escape") {
      e.preventDefault();
      command("close");
    } else if (mode === "detail" && book.open && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      command("page", e.key === "ArrowLeft" ? -1 : 1);
    }
  };

  // A volume is out only on a live stage: between a lost context and its rebuild there is just the poster
  const out = live && (mode === "detail" || mode === "opening");
  const inspecting = live && mode === "detail";
  const pageText = book.open ? `page ${book.page + 1} of ${book.spreads}` : "closed";

  const bookControls = (
    <div className="flex items-center gap-3" data-shelf-book-controls="">
      <CircleButton
        variant="trace"
        size="sm"
        room="notebook"
        label="Previous page"
        icon={<ChevronLeft size={14} />}
        disabled={!book.open || book.page === 0}
        onClick={() => command("page", -1)}
      />
      <span data-shelf-toggle="">
        <Cta variant="trace" size="sm" room="notebook" label={book.open ? "close the book" : "open the book"} onClick={() => command("book")} />
      </span>
      <CircleButton
        variant="trace"
        size="sm"
        room="notebook"
        label="Next page"
        icon={<ChevronRight size={14} />}
        disabled={!book.open || book.page >= book.spreads - 1}
        onClick={() => command("page", 1)}
      />
      <span className="w-24 font-mono text-[10px] tracking-widest text-(--notebook-text-muted) uppercase" data-shelf-page="">
        {pageText}
      </span>
    </div>
  );

  return (
    <div ref={wrapRef} onKeyDown={onKeyDown} data-shelf="" data-shelf-mode={mode}>
      <section aria-label="The shelf" className="relative">
        <div ref={stageRef} className="relative h-[70vh] max-h-180 min-h-110 w-full overflow-hidden">
          <FxStage
            slot="notebook.shelf"
            handle={fx}
            options={options}
            setup={setup}
            className="shelf-stage absolute inset-0"
            posterClassName="bg-(--notebook-surface)"
            onStatusChange={setStatus}
          />
          <div
            ref={setSurface}
            className="shelf-surface absolute inset-0"
            aria-hidden="true"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              if (labelRef.current) labelRef.current.style.transform = `translate(${e.clientX - r.left + 16}px, ${e.clientY - r.top + 18}px)`;
            }}
          />

          {/* The banner hangs on the wall above the shelf, and is taken in while a volume is out */}
          <div
            className={cn(
              "absolute inset-x-0 top-0 mx-auto max-w-4xl px-6 transition-opacity duration-500",
              mode === "shelf" ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            <ClothHeading />
          </div>

          {/* The volume under the pointer, by name (the same name is in the browse bar and the list) */}
          <div
            ref={labelRef}
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-0 left-0 rounded-sm border border-(--notebook-border) bg-(--notebook-surface)/90 px-2 py-1 transition-opacity duration-150",
              live && mode === "shelf" && hovered >= 0 ? "opacity-100" : "opacity-0"
            )}
          >
            {hovered >= 0 && shelf[hovered] && (
              <>
                <span className="block font-mono text-[9px] tracking-widest text-(--notebook-text-muted) uppercase">
                  volume {journalInfo(shelf[hovered].journal).roman}
                </span>
                <span className="block font-serif text-sm text-(--notebook-text)">{journalInfo(shelf[hovered].journal).label}</span>
              </>
            )}
          </div>
        </div>

        {/* Under the stage: browsing controls on the shelf, the book's own controls while one is out */}
        <div className="relative z-10 grid min-h-32 place-items-center px-4 pt-2 pb-6 *:col-start-1 *:row-start-1">
          <div
            className={cn(
              "flex flex-col items-center gap-3 transition-opacity duration-300",
              live && mode === "shelf" ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            inert={!live || mode !== "shelf"}
            data-shelf-browse=""
          >
            <div className="flex items-center gap-4">
              <CircleButton variant="trace" size="sm" room="notebook" label="Previous journal" icon={<ChevronLeft size={14} />} onClick={() => command("step", -1)} />
              <div className="w-56 text-center" data-shelf-current="">
                <p className="font-mono text-[10px] tracking-widest text-(--notebook-text-muted) uppercase">
                  volume {info.roman} · {selected + 1} of {shelf.length}
                </p>
                <p className={cn("font-serif text-2xl leading-tight", JOURNAL_INK[current.journal])}>{info.label}</p>
                <p className="text-xs text-(--notebook-text-muted)">
                  {info.short} · {countLabel(current.count)}
                </p>
              </div>
              <CircleButton variant="trace" size="sm" room="notebook" label="Next journal" icon={<ChevronRight size={14} />} onClick={() => command("step", 1)} />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span data-shelf-inspect="">
                <Cta variant="trace" size="sm" room="notebook" label="look inside" onClick={inspect} />
              </span>
              <Cta variant="keycap" size="sm" room="notebook" label={`open ${info.label.toLowerCase()}`} href={`/notebook/${current.journal}`} />
            </div>
          </div>

          <div
            className={cn("transition-opacity duration-300", inspecting ? "opacity-100" : "pointer-events-none opacity-0")}
            inert={!inspecting}
          >
            {bookControls}
          </div>
        </div>

        {/* The volume that's out: beside it on a wide stage, under the stage below lg */}
        <aside
          ref={panelRef}
          aria-labelledby="shelf-panel-title"
          inert={!inspecting}
          data-shelf-panel=""
          className={cn(
            "z-10 flex flex-col gap-4 border-(--notebook-border) bg-(--notebook-surface)/92 p-6 transition-opacity duration-300",
            "lg:absolute lg:top-6 lg:right-6 lg:bottom-6 lg:w-96 lg:overflow-y-auto lg:rounded-sm lg:border",
            out ? "opacity-100" : "pointer-events-none opacity-0 max-lg:hidden"
          )}
        >
          <p className="font-mono text-[10px] tracking-widest text-(--notebook-text-muted) uppercase">
            volume {info.roman} · {info.short}
          </p>
          <div className="flex items-center gap-3">
            <span className={cn("size-3 shrink-0 rounded-sm", JOURNAL_SWATCH[current.journal])} aria-hidden="true" />
            <h2 id="shelf-panel-title" className="font-serif text-3xl leading-tight text-(--notebook-text)">
              {info.label}
            </h2>
          </div>
          <p className="text-sm text-(--notebook-text-muted)">{info.description}</p>
          <p className="font-mono text-[11px] tracking-wider text-(--notebook-text-muted) uppercase">
            {countLabel(current.count)}
            {current.since && ` · kept since ${formatMonthYear(current.since)}`}
          </p>

          <div>
            <h3 className="mb-2 font-mono text-[10px] tracking-widest text-(--notebook-text-muted) uppercase">latest</h3>
            {current.latest.length ? (
              <ol className="flex flex-col border-t border-(--notebook-border)" data-shelf-latest="">
                {current.latest.map((e) => (
                  <li key={e.slug} className="border-b border-(--notebook-border)">
                    <Link
                      href={`/notebook/${current.journal}/${e.slug}`}
                      className="group flex items-baseline justify-between gap-3 py-2"
                    >
                      <span className={cn("font-serif text-base text-(--notebook-text) group-hover:underline", e.untitled && "italic")}>{e.title}</span>
                      <span className="shrink-0 font-mono text-[10px] text-(--notebook-text-muted)">{formatEntryDate(e.date)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="font-mono text-xs text-(--notebook-text-muted)">Nothing here yet.</p>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-3">
            <Cta variant="keycap" emphasis="primary" size="sm" room="notebook" label="open the journal" href={`/notebook/${current.journal}`} />
            <Cta variant="trace" size="sm" room="notebook" label="back to the shelf" onClick={() => command("close")} />
            <CircleButton variant="trace" size="sm" room="notebook" label="Reset the view" icon={<RotateCcw size={13} />} onClick={() => command("reset")} />
          </div>
          <p className="font-mono text-[10px] text-(--notebook-text-muted)">
            drag the cover or a page to turn it · drag around the book to look at it · esc puts it back
          </p>
        </aside>

        <p role="status" className="sr-only">
          {announce}
        </p>
      </section>

      {/* The same shelf as links: every journal, its size and its latest entry */}
      <nav aria-label="Journals" className="mx-auto mt-10 max-w-5xl px-6 pb-24">
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-sm border border-(--notebook-border) bg-(--notebook-border) sm:grid-cols-2 lg:grid-cols-3" data-shelf-twin="">
          {shelf.map((s, i) => {
            const j = journalInfo(s.journal);
            const latest = s.latest[0];
            return (
              <li key={s.journal} className="bg-(--notebook-surface)">
                <Link
                  href={`/notebook/${s.journal}`}
                  className="group flex h-full flex-col gap-1 p-5 transition-colors duration-150 hover:bg-(--notebook-shadow)/40 focus-visible:bg-(--notebook-shadow)/40"
                  onFocus={() => mode === "shelf" && command("select", i)}
                  onMouseEnter={() => mode === "shelf" && command("select", i)}
                  aria-current={i === selected && mode === "shelf" ? "true" : undefined}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-sm", JOURNAL_SWATCH[s.journal])} aria-hidden="true" />
                    <span className="font-mono text-[10px] tracking-widest text-(--notebook-text-muted) uppercase">volume {j.roman}</span>
                  </span>
                  <span className={cn("font-serif text-xl group-hover:underline", JOURNAL_INK[s.journal])}>{j.label}</span>
                  <span className="text-xs text-(--notebook-text-muted)">
                    {j.short} · {countLabel(s.count)}
                  </span>
                  {latest && (
                    <span className="mt-1 truncate text-xs text-(--notebook-text)">
                      latest: <span className={cn("font-serif", latest.untitled && "italic")}>{latest.title}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

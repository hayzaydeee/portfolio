"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ShelfEntry } from "@/lib/data/notebook";
import { usePrefersReducedMotion } from "@/components/fx/runtime/motion";
import { journalInfo, type Journal } from "@/lib/notebook/journals";
import { formatEntryDate } from "@/lib/notebook/format";

/**
 * Turning to the next or previous entry, as a real page turn. The leaf is ThreeUI's Sketchbook
 * leaf (MIT, Meng To): a chain of nested strips, each turned a little further than its parent,
 * so the page bends as it goes over instead of swinging flat like a door; each strip is lit by
 * the angle it faces. Here the leaf carries the page as it stands (its front faces hold a
 * snapshot of the entry, sliced per strip) and the neighbour's head waits underneath; once the
 * leaf is over, the neighbour loads under it and the turn lifts away.
 *
 * Drag the corner at the bottom of the screen (right for newer, left for older), use the arrow
 * keys, or follow the links at the end of the entry; all three turn the page. Without motion
 * they navigate straight away. Nothing listens for swipes: a sideways scroll in a code block
 * stays a scroll.
 */

type Dir = "next" | "prev";
type Spring = { kind: "spring"; target: number; v: number } | { kind: "tween"; from: number; target: number; dur: number; e: number };
type Turn = {
  dir: Dir;
  href: string;
  t: number;
  root: HTMLDivElement;
  strips: HTMLElement[];
  spring: Spring | null;
  raf: number;
  last: number;
  done: ((t: number) => void) | null;
};

/** Strips in the chain: enough for a smooth bend at screen size */
const N = 14;
/** Peak bend of the arc, radians */
const BETA = 0.6;
const DEG = 180 / Math.PI;
const COMMIT = 0.4;
const TURN_SECONDS = 0.8;

let turns = 0;

/** A turn that has navigated hands its overlay to whichever page arrives, which lifts it */
let handoff: { root: HTMLDivElement; timer: number } | null = null;

function el(tag: string, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function liftHandoff() {
  if (!handoff) return;
  const { root, timer } = handoff;
  handoff = null;
  window.clearTimeout(timer);
  // Let the arriving page paint under the overlay first
  requestAnimationFrame(() => {
    root.classList.add("curl-lifting");
    window.setTimeout(() => root.remove(), 280);
  });
}

/**
 * The page as it stands, for the leaf's front faces. Canvases clone blank, so each one is tagged
 * with its original's index and every strip paints its copies from the originals (a copy on the
 * GPU; a data URL would read the frame back and encode it, which stalls the turn's first frame)
 */
function snapshot(source: HTMLElement) {
  const rect = source.getBoundingClientRect();
  const clone = source.cloneNode(true) as HTMLElement;
  const canvases = Array.from(source.querySelectorAll("canvas"));
  clone.querySelectorAll("canvas").forEach((copy, i) => (copy.dataset.curlCanvas = String(i)));
  // Only what's on screen is carried: anything off it becomes a spacer of the same box, so a
  // long essay costs the leaf no more than a short one (each strip holds its own copy)
  const thin = (original: Element, copy: Element) => {
    Array.from(original.children).forEach((child, i) => {
      const twin = copy.children[i];
      if (!twin || child.tagName === "ARTICLE") return;
      const r = child.getBoundingClientRect();
      if (r.bottom > -64 && r.top < window.innerHeight + 64) return;
      const style = getComputedStyle(child);
      const spacer = el("div");
      spacer.style.height = `${r.height}px`;
      spacer.style.marginTop = style.marginTop;
      spacer.style.marginBottom = style.marginBottom;
      twin.replaceWith(spacer);
    });
  };
  const article = source.querySelector("article");
  const articleCopy = clone.querySelector("article");
  if (article && articleCopy) thin(article, articleCopy);
  thin(source, clone);
  clone.querySelectorAll("[data-curl-ignore]").forEach((n) => n.remove());
  clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
  clone.removeAttribute("data-entry-page");
  clone.style.position = "absolute";
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.margin = "0";
  return { page: clone, canvases };
}

/** The neighbour's head, set where the page will put it, waiting under the leaf */
function underlay(journal: Journal, target: ShelfEntry) {
  const under = el("div", "curl-under");
  const col = el("div", "mx-auto max-w-2xl px-6 pt-28");
  const nav = el("p", "mb-8 font-mono text-xs text-(--notebook-text-muted)");
  nav.textContent = `← ${journalInfo(journal).label}`;
  const head = el("div", "mb-10 px-6 py-9 sm:px-9");
  const date = el("p", "font-script text-base text-(--notebook-text-muted)");
  date.textContent = formatEntryDate(target.date);
  const title = el("p", target.untitled ? "mt-3 font-serif text-lg italic text-(--notebook-text-muted)" : "mt-3 font-serif text-3xl leading-snug text-(--notebook-text)");
  title.textContent = target.title;
  head.append(date, title);
  col.append(nav, head);
  under.append(col);
  return under;
}

function buildTurn(dir: Dir, href: string, journal: Journal, target: ShelfEntry, source: HTMLElement): Turn {
  const W = window.innerWidth;
  // The spine is the reading column's edge, so a turned page lands over the margin like a book's
  // facing page: the left edge going forward, the right edge going back
  const rect = source.getBoundingClientRect();
  const hinge = dir === "next" ? Math.max(0, rect.left) : Math.min(W, rect.right);
  const leaf = dir === "next" ? W - hinge : hinge;
  const root = el("div", "curl-root") as HTMLDivElement;
  root.setAttribute("aria-hidden", "true");
  root.inert = true;
  root.dataset.turn = String(++turns);
  root.style.setProperty("--vw", `${W}px`);
  root.style.setProperty("--lw", `${leaf}px`);
  root.style.setProperty("--n", String(N));

  const { page, canvases } = snapshot(source);
  const spans = canvases.map((c) => c.getBoundingClientRect());
  const curl = el("div", `curl ${dir}`);
  if (dir === "next") curl.style.left = `${hinge}px`;
  else curl.style.right = `${W - hinge}px`;
  const strips: HTMLElement[] = [];
  const sw = leaf / N;
  let host: HTMLElement = curl;
  for (let i = 0; i < N; i++) {
    const strip = el("div", "strip");
    const front = el("div", "face front");
    const back = el("div", "face back");
    // Each front face shows its own slice of the page: the strip's flat position, shifted back
    const left = dir === "next" ? hinge + i * sw : hinge - (i + 1) * sw;
    const slice = el("div", "curl-slice");
    slice.style.left = `${-left}px`;
    const copy = page.cloneNode(true) as HTMLElement;
    // Only the canvases this strip shows are painted; the rest never allocate a buffer
    copy.querySelectorAll<HTMLCanvasElement>("canvas[data-curl-canvas]").forEach((c) => {
      const i = Number(c.dataset.curlCanvas);
      if (spans[i].right < left || spans[i].left > left + sw) return;
      c.getContext("2d")?.drawImage(canvases[i], 0, 0);
    });
    slice.append(copy);
    front.append(slice, el("div", "sh"), el("div", "gl"));
    back.append(el("div", "sh"), el("div", "gl"));
    strip.append(front, back);
    if (i === N - 1) strip.classList.add("edge");
    host.append(strip);
    host = strip;
    strips.push(strip);
  }
  // The lifting leaf's shadow on the page beneath, falling away from the spine
  const shade = el("div", `curl-shade ${dir}`);
  if (dir === "next") shade.style.left = `${hinge}px`;
  else shade.style.right = `${W - hinge}px`;
  const under = underlay(journal, target);
  under.append(shade);
  root.append(under, curl);
  document.body.append(root);
  return { dir, href, t: 0, root, strips, spring: null, raf: 0, last: 0, done: null };
}

function applyTurn(turn: Turn) {
  const { t } = turn;
  turn.root.dataset.t = t.toFixed(3);
  const th = Math.PI * t;
  const beta = BETA * Math.sin(Math.PI * t);
  const tt = th + beta;
  const td = (2 * beta) / N;
  turn.root.style.setProperty("--tt", `${(tt * DEG).toFixed(2)}deg`);
  turn.root.style.setProperty("--td", `${(td * DEG).toFixed(3)}deg`);
  turn.root.style.setProperty("--shade", Math.sin(Math.PI * t).toFixed(3));
  turn.strips.forEach((strip, i) => {
    const l1 = Math.abs(Math.cos(tt - i * td));
    const l2 = Math.abs(Math.cos(tt - (i + 1) * td));
    strip.style.setProperty("--lit", l1.toFixed(3));
    strip.style.setProperty("--a1", ((1 - l1) * 0.62).toFixed(3));
    strip.style.setProperty("--a2", ((1 - l2) * 0.62).toFixed(3));
  });
}

const smoothstep = (x: number) => x * x * (3 - 2 * x);

function run(turn: Turn, spring: Spring, done: (t: number) => void) {
  turn.spring = spring;
  turn.done = done;
  cancelAnimationFrame(turn.raf);
  turn.last = performance.now();
  const tick = (now: number) => {
    // Real elapsed time, so a slow device turns the page in the same time with fewer frames
    // (the spring integrates it in small steps, which keeps it stable)
    // (a frame's timestamp can predate a clock read taken late in a long task, so never below zero)
    const elapsed = Math.min(0.25, Math.max(0, (now - turn.last) / 1000));
    turn.last = now;
    const s = turn.spring;
    if (!s) return;
    let settled = false;
    if (s.kind === "tween") {
      s.e += elapsed;
      const k = Math.min(1, s.e / s.dur);
      turn.t = s.from + (s.target - s.from) * smoothstep(k);
      settled = k >= 1;
    } else {
      // The original's spring: stiffness 150, damping 22
      for (let left = elapsed; left > 1e-6 && !settled; left -= 1 / 120) {
        const dt = Math.min(1 / 120, left);
        const x = turn.t - s.target;
        s.v += (-150 * x - 22 * s.v) * dt;
        turn.t += s.v * dt;
        settled = Math.abs(turn.t - s.target) < 0.002 && Math.abs(s.v) < 0.02;
      }
      if (settled) turn.t = s.target;
    }
    turn.t = Math.min(1, Math.max(0, turn.t));
    applyTurn(turn);
    if (settled) {
      turn.spring = null;
      turn.done?.(turn.t);
    } else turn.raf = requestAnimationFrame(tick);
  };
  turn.raf = requestAnimationFrame(tick);
}

export function PageCurl({
  journal,
  older,
  newer,
  base = "/notebook",
}: {
  journal: Journal;
  older: ShelfEntry | null;
  newer: ShelfEntry | null;
  /** Where entries live (the harness serves its fixtures under its own path) */
  base?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();
  const turnRef = useRef<Turn | null>(null);
  const drag = useRef<{ id: number; startX: number; lastX: number; lastT: number; v: number } | null>(null);

  const hrefFor = (target: ShelfEntry) => `${base}/${journal}/${target.slug}`;
  const targetFor = (dir: Dir) => (dir === "next" ? newer : older);

  // The page that arrives lifts an overlay a turn handed over; a turn left behind is taken down
  useEffect(() => {
    liftHandoff();
  }, [pathname]);
  useEffect(
    () => () => {
      const turn = turnRef.current;
      if (turn && (!handoff || handoff.root !== turn.root)) {
        cancelAnimationFrame(turn.raf);
        turn.root.remove();
      }
    },
    []
  );

  useEffect(() => {
    for (const target of [older, newer]) if (target) router.prefetch(`${base}/${journal}/${target.slug}`);
  }, [router, base, journal, older, newer]);

  const begin = (dir: Dir) => {
    const target = targetFor(dir);
    const source = document.querySelector<HTMLElement>("[data-entry-page]");
    if (!target || !source || turnRef.current) return null;
    const turn = buildTurn(dir, hrefFor(target), journal, target, source);
    applyTurn(turn);
    turnRef.current = turn;
    return turn;
  };

  const finish = (turn: Turn) => (t: number) => {
    if (t >= 1) {
      handoff = { root: turn.root, timer: window.setTimeout(() => turn.root.remove(), 5000) };
      turnRef.current = null;
      router.push(turn.href);
    } else {
      turn.root.remove();
      turnRef.current = null;
    }
  };

  /** Keys and links: the whole turn, then the neighbour */
  const turnTo = (dir: Dir) => {
    const target = targetFor(dir);
    if (!target) return;
    if (reduced) {
      router.push(hrefFor(target));
      return;
    }
    const turn = begin(dir);
    if (turn) run(turn, { kind: "tween", from: 0, target: 1, dur: TURN_SECONDS, e: 0 }, finish(turn));
  };

  // Arrow keys, unless something else is taking them (a field, a modifier, a turn under way)
  const turnToRef = useRef(turnTo);
  useEffect(() => {
    turnToRef.current = turnTo;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='slider']")) return;
      e.preventDefault();
      turnToRef.current(e.key === "ArrowRight" ? "next" : "prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onLink = (dir: Dir) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (reduced || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    turnTo(dir);
  };

  // The corner: the leaf follows the pointer, and lands over or falls back on release
  const onCornerDown = (dir: Dir) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.button !== 0) return;
    const turn = begin(dir);
    if (!turn) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, lastT: performance.now(), v: 0 };
  };
  const onCornerMove = (dir: Dir) => (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const turn = turnRef.current;
    if (!d || !turn || d.id !== e.pointerId) return;
    const now = performance.now();
    const along = dir === "next" ? d.lastX - e.clientX : e.clientX - d.lastX;
    d.v = d.v * 0.6 + (along / Math.max(1, now - d.lastT)) * 1000 * 0.4;
    d.lastX = e.clientX;
    d.lastT = now;
    const travel = dir === "next" ? d.startX - e.clientX : e.clientX - d.startX;
    turn.t = Math.min(1, Math.max(0, travel / (window.innerWidth * 0.9)));
    applyTurn(turn);
  };
  const onCornerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const turn = turnRef.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!turn) return;
    const over = turn.t > COMMIT || d.v > 900;
    run(turn, { kind: "spring", target: over ? 1 : 0, v: 0 }, finish(turn));
  };

  if (!older && !newer) return null;

  return (
    <>
      <nav aria-label="Older and newer entries" data-curl-ignore="" className="mt-16 grid grid-cols-2 gap-6 border-t border-(--notebook-border) pt-6">
        {older ? (
          <Link href={hrefFor(older)} onClick={onLink("prev")} className="group flex flex-col items-start gap-1" data-curl-link="prev">
            <span className="font-mono text-xs text-(--notebook-text-muted)">← older</span>
            <span className={`font-serif text-base text-(--notebook-text) group-hover:underline ${older.untitled ? "italic" : ""}`}>{older.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {newer ? (
          <Link href={hrefFor(newer)} onClick={onLink("next")} className="group flex flex-col items-end gap-1 text-right" data-curl-link="next">
            <span className="font-mono text-xs text-(--notebook-text-muted)">newer →</span>
            <span className={`font-serif text-base text-(--notebook-text) group-hover:underline ${newer.untitled ? "italic" : ""}`}>{newer.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>

      {!reduced &&
        (["prev", "next"] as const).map((dir) =>
          targetFor(dir) ? (
            <div
              key={dir}
              aria-hidden="true"
              data-curl-ignore=""
              data-curl-corner={dir}
              className={`curl-corner ${dir}`}
              onPointerDown={onCornerDown(dir)}
              onPointerMove={onCornerMove(dir)}
              onPointerUp={onCornerUp}
              onPointerCancel={onCornerUp}
            />
          ) : null
        )}
    </>
  );
}

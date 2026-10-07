"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ExternalLink, GitBranch } from "lucide-react";
import { Cta } from "@/components/fx/ui/Cta";
import { TransitionLink } from "@/components/fx/ui/TransitionLink";
import { addToTicker } from "@/components/fx/runtime/ticker";
import type { FeaturedProject } from "@/lib/data/projects";

/**
 * Fork of ThreeUI's Character Wave (MIT, Meng To): a looping deck of cards laid along a wave
 * in 3D, the focused card lifted toward you and the rest falling away by distance. The
 * original's portrait cards become project cards; pointer, horizontal wheel, swipe and arrow
 * keys move the wave, and the focused project's detail sits under the deck as plain DOM.
 * Layout is written straight to the cards from the shared ticker, never through React state.
 */

/**
 * Short decks repeat so the wave always has both flanks. Repeats stay clickable (one can land
 * in front) but are hidden from assistive tech and the tab order, so each project is announced
 * and tabbed to once
 */
const MIN_CARDS = 7;
const IDLE_MS = 4200;
/** Dark palettes only: a cream poster would glare out of the lobby */
const ROOMS = ["workshop", "studio", "lobby"] as const;

type Slot = { project: FeaturedProject; real: number; copy: boolean };

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** No thumbnail yet: a poster in one of the house palettes, picked by slug */
function Poster({ project }: { project: FeaturedProject }) {
  const room = ROOMS[hash(project.slug) % ROOMS.length];
  return (
    <div className="prim absolute inset-0 overflow-hidden bg-(--prim-deep)" data-room={room}>
      <div className="absolute inset-0 bg-linear-to-br from-(--prim-accent)/45 via-transparent to-(--prim-glow)/25" />
      <span className="absolute -right-2 -bottom-6 font-sans text-[7rem] leading-none font-medium text-(--prim-ink)/15 select-none">
        {project.title.charAt(0)}
      </span>
      <span className="absolute top-2.5 left-3 font-mono text-[10px] text-(--prim-ink)/60">{project.slug}</span>
    </div>
  );
}

export function ProjectWave({ projects }: { projects: FeaturedProject[] }) {
  const id = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const [active, setActive] = useState(0);

  const deck = useMemo<Slot[]>(() => {
    const n = projects.length;
    const out: Slot[] = [];
    for (let i = 0; n && out.length < Math.max(MIN_CARDS, n); i++) out.push({ project: projects[i % n], real: i % n, copy: i >= n });
    return out;
  }, [projects]);
  const count = deck.length;

  const s = useRef({
    phase: 0,
    target: 0,
    base: 0,
    orientation: 0,
    targetOrientation: 0,
    pointerX: 0,
    pointerY: 0,
    tiltX: 0,
    tiltY: 0,
    pointing: false,
    lastInput: 0,
    nearest: 0,
    visible: true,
    reduced: false,
    swipeX: null as number | null,
    width: 0,
    height: 0,
  });

  const wrapped = useCallback(
    (index: number, phase: number) => {
      let d = index - phase;
      while (d > count / 2) d -= count;
      while (d < -count / 2) d += count;
      return d;
    },
    [count]
  );

  const layout = useCallback(
    (now: number, dt: number) => {
      const st = s.current;
      const stage = stageRef.current;
      if (!stage || !count) return;
      // Eased by real elapsed time, so a slow frame doesn't make the deck lag behind input
      const ease = st.reduced ? 1 : 1 - Math.pow(0.0007, Math.min(100, dt) / 1000);

      // Left alone, the wave drifts to and fro and leans a little toward vertical
      if (!st.reduced && !st.pointing && now - st.lastInput > IDLE_MS) {
        const idle = now - st.lastInput - IDLE_MS;
        st.target = st.base + Math.sin(idle * 0.00034) * 1.9;
        st.targetOrientation = ((Math.sin(idle * 0.00019 - Math.PI / 2) + 1) / 2) * 0.35;
      }

      st.phase += (st.target - st.phase) * ease;
      st.orientation += (st.targetOrientation - st.orientation) * ease * 0.72;
      st.tiltX += ((st.pointing ? st.pointerX : 0) - st.tiltX) * ease * 0.72;
      st.tiltY += ((st.pointing ? st.pointerY : 0) - st.tiltY) * ease * 0.72;

      const { width, height } = st;
      const across = Math.min(200, Math.max(130, width * 0.13));
      const down = Math.min(180, Math.max(120, height * 0.2));
      const o = st.orientation;

      const nearest = ((Math.round(st.phase) % count) + count) % count;
      if (nearest !== st.nearest) {
        st.nearest = nearest;
        setActive(deck[nearest].real);
      }

      cards.current.forEach((card, index) => {
        if (!card) return;
        const delta = wrapped(index, st.phase);
        const distance = Math.abs(delta);
        const focus = Math.exp(-distance * distance * 1.05);
        const side = Math.max(0, 1 - distance / 5);
        const dir = Math.sign(delta);

        const hx = delta * across;
        const hy = -Math.pow(distance, 1.45) * 6 + Math.sin(delta * 0.8) * 5;
        const vx = Math.sin(delta * 0.82) * Math.min(78, width * 0.06) + dir * Math.pow(distance, 1.25) * 8;
        const vy = delta * down;
        const x = hx * (1 - o) + vx * o;
        const y = hy * (1 - o) + vy * o;
        const z = focus * 95 - distance * 78;
        const scale = 0.57 + side * 0.16 + focus * 0.38;
        const rx = -st.tiltY * focus * 5 + delta * 2.2 * o;
        const ry = st.tiltX * focus * 7 - delta * 8.5 * (1 - o);
        const rz = delta * 2.25 * (1 - o) - delta * 1.4 * o;

        card.style.setProperty("--focus", focus.toFixed(4));
        card.style.zIndex = String(Math.round(1000 - distance * 100));
        card.style.opacity = String(Math.max(0.14, side * 0.82 + focus * 0.18));
        card.style.filter = `blur(${(Math.max(0, distance - 1.35) * 0.45).toFixed(2)}px) saturate(${(0.72 + focus * 0.28).toFixed(3)})`;
        card.style.transform =
          `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) ` +
          `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${scale.toFixed(4)})`;
      });
    },
    [count, deck, wrapped]
  );

  const select = useCallback(
    (index: number) => {
      const st = s.current;
      let d = index - st.nearest;
      if (d > count / 2) d -= count;
      if (d < -count / 2) d += count;
      st.base = Math.round(st.phase) + d;
      st.target = st.base;
      st.lastInput = performance.now();
      if (st.reduced) layout(st.lastInput, 0);
    },
    [count, layout]
  );

  const step = useCallback(
    (dir: number) => {
      const st = s.current;
      st.base += dir;
      st.target = st.base;
      st.pointing = false;
      st.lastInput = performance.now();
      if (st.reduced) layout(st.lastInput, 0);
    },
    [layout]
  );

  // The loop, its visibility gate, and the gestures that need a non-passive listener
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const st = s.current;
    st.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const measure = () => {
      const r = stage.getBoundingClientRect();
      st.width = r.width;
      st.height = r.height;
      if (st.reduced) layout(performance.now(), 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    st.lastInput = performance.now();
    layout(st.lastInput, 0);

    const io = new IntersectionObserver(([e]) => {
      st.visible = e?.isIntersecting ?? true;
    });
    io.observe(stage);

    // Horizontal wheel and trackpad swipes move the deck; vertical ones stay with the page
    let wheelAcc = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      wheelAcc += e.deltaX;
      if (Math.abs(wheelAcc) < 40) return;
      step(Math.sign(wheelAcc));
      wheelAcc = 0;
    };
    stage.addEventListener("wheel", onWheel, { passive: false });

    const stop = st.reduced ? () => {} : addToTicker(`wave${id}`, layout, () => st.visible);
    return () => {
      io.disconnect();
      ro.disconnect();
      stage.removeEventListener("wheel", onWheel);
      stop();
    };
  }, [id, layout, step]);

  const onPointerMove = (e: React.PointerEvent) => {
    const st = s.current;
    if (e.pointerType !== "mouse" || st.reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width - 0.5) * 2));
    const ny = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height - 0.5) * 2));
    st.pointerX = nx;
    st.pointerY = ny;
    st.pointing = true;
    st.lastInput = performance.now();
    const axis = st.targetOrientation > 0.5 ? ny : nx;
    st.target = st.base + axis * (rect.width < 680 ? 1.55 : 2.45);
  };

  const onPointerLeave = () => {
    const st = s.current;
    st.pointing = false;
    st.target = st.base;
  };

  // Touch: a horizontal swipe steps the deck (touch-action keeps vertical scroll native)
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") s.current.swipeX = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const st = s.current;
    if (st.swipeX === null) return;
    const dx = st.swipeX - e.clientX;
    st.swipeX = null;
    if (Math.abs(dx) > 40) step(Math.sign(dx));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = projects.length;
    const next = (active + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
    select(deck.findIndex((slot) => slot.real === next && !slot.copy));
    links.current[next]?.focus({ preventScroll: true });
  };

  const current = projects[active];

  return (
    <div>
      <div
        ref={stageRef}
        className="wave-stage h-[62vh] min-h-120"
        data-gesture-capture="x"
        data-project-wave=""
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (s.current.swipeX = null)}
        onKeyDown={onKeyDown}
      >
        <p className="sr-only">Use the left and right arrow keys to move between projects.</p>
        <div className="wave-deck">
          {deck.map(({ project, real, copy }, i) => (
            <article
              key={`${project.id}-${i}`}
              ref={(el) => {
                cards.current[i] = el;
              }}
              className="wave-card"
              aria-hidden={copy || undefined}
              aria-current={!copy && real === active ? "true" : undefined}
              data-wave-card={copy ? "copy" : project.slug}
              onClick={() => select(i)}
            >
              <div className="wave-card__art">
                {project.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.thumbnail_url} alt="" className="size-full object-cover" />
                ) : (
                  <Poster project={project} />
                )}
              </div>
              <div className="wave-card__body">
                <h3 className="truncate font-sans text-sm font-medium">
                  <TransitionLink
                    href={`/work/${project.slug}`}
                    ref={(el) => {
                      if (!copy) links.current[real] = el;
                    }}
                    tabIndex={copy ? -1 : undefined}
                    className="outline-none"
                    onFocus={() => select(i)}
                  >
                    {project.title}
                  </TransitionLink>
                </h3>
                {project.tagline && <p className="line-clamp-2 text-[11px] leading-snug text-text-muted">{project.tagline}</p>}
                {project.stack.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {project.stack.slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-(--lobby-surface-deep) px-1.5 py-0.5 font-mono text-[9px] text-text-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* The focused project in full, as plain text under the wave */}
      {current && (
        <div
          className="mx-auto mt-6 max-w-2xl rounded-xl bg-(--lobby-surface)/70 px-6 py-4 text-center backdrop-blur-sm"
          aria-live="polite"
          data-wave-detail={current.slug}
        >
          <h3 className="font-sans text-lg font-medium text-(--lobby-text)">{current.title}</h3>
          {current.personal_note && (
            <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-text-muted">{current.personal_note}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
            <Cta variant="slide" href={`/work/${current.slug}`} label="open in the workshop" size="sm" room="lobby" />
            {current.live_url && (
              <a
                href={current.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent-light"
              >
                <ExternalLink size={13} /> live
              </a>
            )}
            {current.repo_url && (
              <a
                href={current.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent-light"
              >
                <GitBranch size={13} /> repo
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

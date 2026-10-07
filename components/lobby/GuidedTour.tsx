"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { FxStage } from "@/components/fx/FxStage";
import { Cta } from "@/components/fx/ui/Cta";
import { HzyOrb } from "@/components/fx/ui/HzyOrb";
import type { RoomKey } from "@/components/fx/runtime/types";

// ── Tour stop definitions ─────────────────────────────────────────────────────

type Stop = {
  room: Exclude<RoomKey, "lobby">;
  title: string;
  desc: string;
  enter: string;
  href: string;
  Decoration: () => React.ReactNode;
};

const STOPS: readonly Stop[] = [
  {
    room: "workshop",
    title: "the workshop",
    desc: "where the code lives. projects, build decisions, and a terminal at the bottom of each file.",
    enter: "enter workshop",
    href: "/work",
    Decoration: WorkshopDecoration,
  },
  {
    room: "studio",
    title: "the studio",
    desc: "music in progress. tracks, critical writing, and things still in the lab.",
    enter: "enter studio",
    href: "/music",
    Decoration: StudioDecoration,
  },
  {
    room: "notebook",
    title: "the notebook",
    desc: "six journals. different cadences for different kinds of thought.",
    enter: "enter notebook",
    href: "/notebook",
    Decoration: NotebookDecoration,
  },
  {
    room: "wall",
    title: "the wall",
    desc: "things that accumulate. art, video, anything that doesn't fit anywhere else.",
    enter: "enter wall",
    href: "/wall",
    Decoration: WallDecoration,
  },
];

// ── Atmospheric decorations per room ─────────────────────────────────────────

const FILES = [
  { name: "README.md", top: "top-[18%]" },
  { name: "vrrbose/", top: "top-[32%]" },
  { name: "bito.works/", top: "top-[46%]" },
  { name: "stack.json", top: "top-[60%]" },
  { name: ".debug/life.log", top: "top-[74%]" },
];

function WorkshopDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40 select-none">
      {FILES.map(({ name, top }) => (
        <div key={name} className={cn("absolute left-[12%] font-mono text-[11px] text-(--workshop-syntax-dim)", top)}>
          {name}
        </div>
      ))}
      <div className="absolute bottom-[10%] left-[12%] animate-pulse font-mono text-[10px] text-(--workshop-syntax)">
        {`$ ask("what's the most interesting part?")▋`}
      </div>
    </div>
  );
}

const WAVE = Array.from({ length: 52 }, (_, i) => 8 + Math.abs(Math.sin(i * 0.7) * 40));

function StudioDecoration() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center opacity-25 select-none">
      <svg width="260" height="60" viewBox="0 0 260 60" fill="none" aria-hidden="true">
        {WAVE.map((h, i) => (
          <rect key={i} x={i * 5} y={(60 - h) / 2} width={3} height={h} rx={1.5} className="fill-(--studio-accent-light)" />
        ))}
      </svg>
    </div>
  );
}

const JOURNALS = [
  "bg-(--notebook-reflections) -rotate-8 left-[5%] top-[15%]",
  "bg-(--notebook-fragments) rotate-4 left-[19%] top-[20%]",
  "bg-(--notebook-annotations) -rotate-3 left-[33%] top-[12%]",
  "bg-(--notebook-responses) rotate-6 left-[47%] top-[18%]",
  "bg-(--notebook-buildlog) -rotate-5 left-[61%] top-[14%]",
  "bg-(--notebook-cookbook) rotate-3 left-[75%] top-[20%]",
];

function NotebookDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-30 select-none">
      {JOURNALS.map((cls) => (
        <div key={cls} className={cn("absolute h-18 w-13 rounded", cls)} />
      ))}
    </div>
  );
}

const POLAROIDS = ["-rotate-5 left-[8%] top-[15%]", "rotate-3 left-[62%] top-[10%]", "-rotate-2 left-[78%] top-[38%]"];

function WallDecoration() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-40 select-none">
      {POLAROIDS.map((cls) => (
        <div key={cls} className={cn("absolute w-16 bg-white/80 p-1.5 pb-5 shadow", cls)}>
          <div className="aspect-square w-full bg-(--wall-texture)" />
        </div>
      ))}
    </div>
  );
}

/** The current stop runs live; dark rooms show their horizon, light rooms the HZY orb */
function StopPreview({ room }: { room: Stop["room"] }) {
  if (room === "studio") {
    return <FxStage effect="bell-field" room="studio" priority={1} className="absolute inset-0" posterClassName="bg-(--studio-base)" />;
  }
  if (room === "workshop") {
    return (
      <FxStage effect="emerald-horizon" room="workshop" priority={1} className="absolute inset-0" posterClassName="bg-(--workshop-base)" />
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <HzyOrb size="lg" room={room} motion="sweep" />
    </div>
  );
}

// ── Main tour component ───────────────────────────────────────────────────────

type GuidedTourProps = {
  onClose: () => void;
};

export function GuidedTour({ onClose }: GuidedTourProps) {
  const [stopIndex, setStopIndex] = useState(0);
  const stop = STOPS[stopIndex];
  const isLast = stopIndex === STOPS.length - 1;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // A modal: focus moves in on open, Escape leaves, and focus returns to whatever opened it
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  function handleNext() {
    if (isLast) onClose();
    else setStopIndex((i) => i + 1);
  }

  return (
    <motion.div
      key="tour-backdrop"
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-(--lobby-surface)/85 p-6 backdrop-blur-sm outline-none"
      data-guided-tour=""
    >
      {stopIndex === 0 && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 0.55, y: 0 }}
          className="absolute top-8 left-1/2 -translate-x-1/2 text-center font-sans text-sm whitespace-nowrap text-(--lobby-text)"
        >
          you just left the lobby. let me show you the rest of the house.
        </motion.p>
      )}

      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 font-mono text-xs text-(--lobby-text) opacity-40 transition-opacity hover:opacity-80 focus-visible:opacity-80"
        aria-label="exit tour"
      >
        exit tour ✕
      </button>

      <div className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          <motion.div
            key={stop.room}
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -12 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="prim relative w-full overflow-hidden rounded-2xl bg-(--prim-deep) shadow-2xl"
            data-room={stop.room}
            data-tour-stop={stop.room}
          >
            <div className="relative h-52 overflow-hidden bg-(--prim-surface)" data-tour-preview="">
              <StopPreview room={stop.room} />
              <stop.Decoration />
            </div>

            <div className="px-8 py-6">
              <h2 id="tour-title" className="mb-2 font-sans text-2xl font-medium tracking-tight text-(--prim-ink)">
                {stop.title}
              </h2>
              <p className="mb-6 text-sm leading-relaxed text-(--prim-muted)">{stop.desc}</p>

              <div className="flex items-center justify-between gap-4">
                <Cta variant="slide" href={stop.href} label={stop.enter} size="sm" room={stop.room} onClick={onClose} />
                <Cta
                  variant="spin"
                  label={isLast ? "done" : "keep going"}
                  icon={isLast ? null : undefined}
                  size="sm"
                  room={stop.room}
                  onClick={handleNext}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Every stop as a poster; the current one is the live card above */}
        <ol className="mt-4 grid list-none grid-cols-4 gap-2 p-0" aria-label="tour stops">
          {STOPS.map((s, i) => (
            <li key={s.room}>
              <button
                type="button"
                onClick={() => setStopIndex(i)}
                aria-label={`go to ${s.title}`}
                aria-current={i === stopIndex ? "step" : undefined}
                className={cn(
                  "prim relative block h-12 w-full overflow-hidden rounded-lg border bg-(--prim-deep) text-left transition",
                  i === stopIndex ? "border-(--prim-accent)" : "border-transparent opacity-60 hover:opacity-100 focus-visible:opacity-100"
                )}
                data-room={s.room}
              >
                <span className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-(--prim-accent)/40 to-transparent" />
                <span className="relative px-2 font-mono text-[10px] text-(--prim-ink)">{s.room}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </motion.div>
  );
}

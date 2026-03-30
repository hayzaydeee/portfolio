"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

// ── Tour stop definitions ─────────────────────────────────────────────────────

const STOPS = [
  {
    key: "workshop",
    title: "the workshop",
    desc: "where the code lives. projects, build decisions, and a terminal at the bottom of each file.",
    enter: "enter workshop",
    href: "/work",
    bg: "var(--workshop-base)",
    panel: "var(--workshop-panel)",
    text: "var(--workshop-text)",
    muted: "var(--workshop-text-muted)",
    accent: "var(--workshop-syntax)",
    Decoration: WorkshopDecoration,
  },
  {
    key: "studio",
    title: "the studio",
    desc: "music in progress. tracks, critical writing, and things still in the lab.",
    enter: "enter studio",
    href: "/music",
    bg: "var(--studio-base)",
    panel: "var(--studio-panel)",
    text: "var(--studio-text)",
    muted: "var(--studio-text-muted)",
    accent: "var(--studio-accent-light)",
    Decoration: StudioDecoration,
  },
  {
    key: "notebook",
    title: "the notebook",
    desc: "five journals. different cadences for different kinds of thought.",
    enter: "enter notebook",
    href: "/notebook",
    bg: "var(--notebook-surface)",
    panel: "var(--notebook-shadow)",
    text: "var(--notebook-text)",
    muted: "var(--notebook-text-muted)",
    accent: "var(--notebook-fragments)",
    Decoration: NotebookDecoration,
  },
  {
    key: "wall",
    title: "the wall",
    desc: "things that accumulate. art, video, anything that doesn't fit anywhere else.",
    enter: "enter wall",
    href: "/wall",
    bg: "var(--wall-surface)",
    panel: "var(--wall-texture)",
    text: "var(--wall-caption)",
    muted: "var(--wall-date)",
    accent: "var(--wall-pin)",
    Decoration: WallDecoration,
  },
] as const;

// ── Atmospheric decorations per room ─────────────────────────────────────────

function WorkshopDecoration() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none opacity-25">
      {["README.md", "vrrbose/", "bito.works/", "stack.json", ".debug/life.log"].map(
        (name, i) => (
          <div
            key={name}
            className="absolute font-mono text-xs"
            style={{
              top: `${18 + i * 14}%`,
              left: "12%",
              color: "var(--workshop-syntax-dim)",
              fontSize: "11px",
            }}
          >
            {name}
          </div>
        )
      )}
      <div
        className="absolute font-mono text-[10px] animate-pulse"
        style={{ bottom: "20%", left: "12%", color: "var(--workshop-syntax)" }}
      >
        $ ask("what's the most interesting part?")▋
      </div>
    </div>
  );
}

function StudioDecoration() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-20">
      <svg width="260" height="60" viewBox="0 0 260 60" fill="none">
        {Array.from({ length: 52 }, (_, i) => {
          const h = 8 + Math.abs(Math.sin(i * 0.7) * 40);
          return (
            <rect
              key={i}
              x={i * 5}
              y={(60 - h) / 2}
              width={3}
              height={h}
              rx={1.5}
              fill="var(--studio-accent-light)"
            />
          );
        })}
      </svg>
    </div>
  );
}

function NotebookDecoration() {
  const journals = [
    { color: "var(--notebook-reflections)", rotate: "-8deg", x: "8%", y: "15%" },
    { color: "var(--notebook-fragments)", rotate: "4deg", x: "22%", y: "20%" },
    { color: "var(--notebook-annotations)", rotate: "-3deg", x: "36%", y: "12%" },
    { color: "var(--notebook-responses)", rotate: "6deg", x: "50%", y: "18%" },
    { color: "var(--notebook-buildlog)", rotate: "-5deg", x: "64%", y: "14%" },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none select-none opacity-30">
      {journals.map((j, i) => (
        <div
          key={i}
          className="absolute rounded"
          style={{
            background: j.color,
            transform: `rotate(${j.rotate})`,
            left: j.x,
            top: j.y,
            width: "52px",
            height: "72px",
          }}
        />
      ))}
    </div>
  );
}

function WallDecoration() {
  const polaroids = [
    { rotate: "-5deg", x: "8%", y: "15%" },
    { rotate: "3deg", x: "38%", y: "10%" },
    { rotate: "-2deg", x: "62%", y: "20%" },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none select-none opacity-35">
      {polaroids.map((p, i) => (
        <div
          key={i}
          className="absolute bg-white/80 shadow"
          style={{
            transform: `rotate(${p.rotate})`,
            left: p.x,
            top: p.y,
            width: "64px",
            padding: "6px 6px 20px",
          }}
        >
          <div
            className="w-full"
            style={{ aspectRatio: "1", background: "var(--wall-texture)" }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Main tour component ───────────────────────────────────────────────────────

type GuidedTourProps = {
  onClose: () => void;
};

export function GuidedTour({ onClose }: GuidedTourProps) {
  const router = useRouter();

  // tour has its own internal stop state
  const [stopIndex, setStopIndex] = useStopState(0);
  const stop = STOPS[stopIndex];
  const isLast = stopIndex === STOPS.length - 1;

  function handleEnter() {
    onClose();
    router.push(stop.href);
  }

  function handleNext() {
    if (isLast) {
      onClose();
    } else {
      setStopIndex((i) => i + 1);
    }
  }

  return (
    <motion.div
      key="tour-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(12, 17, 10, 0.85)", backdropFilter: "blur(4px)" }}
    >
      {/* Opening caption */}
      {stopIndex === 0 && (
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-8 left-1/2 -translate-x-1/2 text-sm font-sans text-center whitespace-nowrap"
          style={{ color: "var(--lobby-text)", opacity: 0.55 }}
        >
          you just left the lobby. let me show you the rest of the house.
        </motion.p>
      )}

      {/* Exit button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 text-xs font-mono transition-opacity opacity-40 hover:opacity-80"
        style={{ color: "var(--lobby-text)" }}
        aria-label="exit tour"
      >
        exit tour ✕
      </button>

      {/* Stop card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stop.key}
          initial={{ opacity: 0, scale: 0.97, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -12 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: stop.bg }}
        >
          {/* Atmospheric decoration */}
          <div className="relative h-52 overflow-hidden" style={{ background: stop.panel }}>
            <stop.Decoration />
          </div>

          {/* Content */}
          <div className="px-8 py-6" style={{ background: stop.bg }}>
            {/* Progress dots */}
            <div className="flex gap-1.5 mb-4">
              {STOPS.map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full transition-opacity"
                  style={{
                    background: stop.accent,
                    opacity: i <= stopIndex ? 1 : 0.25,
                  }}
                />
              ))}
            </div>

            <h2
              className="text-2xl font-sans font-medium tracking-tight mb-2"
              style={{ color: stop.text }}
            >
              {stop.title}
            </h2>
            <p
              className="text-sm leading-relaxed mb-6"
              style={{ color: stop.muted }}
            >
              {stop.desc}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleEnter}
                className="text-sm font-sans underline underline-offset-2 transition-opacity hover:opacity-70"
                style={{ color: stop.accent }}
              >
                {stop.enter}
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 text-sm font-sans px-4 py-1.5 rounded-full transition-opacity hover:opacity-80"
                style={{
                  background: stop.accent,
                  color: stop.bg,
                }}
              >
                {isLast ? "done" : <>keep going <span aria-hidden>→</span></>}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ── Simple state hook ─────────────────────────────────────────────────────────

import { useState } from "react";

function useStopState(initial: number) {
  return useState<number>(initial);
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import type { Journal } from "@/lib/data/notebook";

type JournalConfig = {
  id: Journal;
  label: string;
  description: string;
  color: string;
  rotation: number;
  offsetX: number;
  offsetY: number;
};

const JOURNALS: JournalConfig[] = [
  {
    id: "reflections",
    label: "Reflections",
    description: "Long-form essays",
    color: "var(--notebook-reflections)",
    rotation: -3,
    offsetX: -16,
    offsetY: 8,
  },
  {
    id: "fragments",
    label: "Fragments",
    description: "Short observations",
    color: "var(--notebook-fragments)",
    rotation: 2,
    offsetX: 8,
    offsetY: -12,
  },
  {
    id: "annotations",
    label: "Annotations",
    description: "Scripture and theology",
    color: "var(--notebook-annotations)",
    rotation: -1.5,
    offsetX: -4,
    offsetY: 16,
  },
  {
    id: "responses",
    label: "Responses",
    description: "Film and music",
    color: "var(--notebook-responses)",
    rotation: 3.5,
    offsetX: 12,
    offsetY: -6,
  },
  {
    id: "buildlog",
    label: "Build log",
    description: "Software and building",
    color: "var(--notebook-buildlog)",
    rotation: -2.5,
    offsetX: -8,
    offsetY: 4,
  },
];

function JournalCard({
  journal,
  onOpen,
}: {
  journal: JournalConfig;
  onOpen: (id: Journal) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      className="relative cursor-pointer select-none"
      style={{
        rotate: journal.rotation,
        x: journal.offsetX,
        y: journal.offsetY,
      }}
      whileHover={{
        y: journal.offsetY - 8,
        scale: 1.02,
        zIndex: 20,
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onOpen(journal.id)}
    >
      {/* Journal cover */}
      <div
        className="relative w-44 rounded-sm overflow-hidden"
        style={{
          background: journal.color,
          boxShadow: hovered
            ? "0 16px 40px rgba(28,26,22,0.28), 0 4px 12px rgba(28,26,22,0.18)"
            : "0 6px 20px rgba(28,26,22,0.18), 0 2px 6px rgba(28,26,22,0.12)",
          aspectRatio: "3 / 4",
        }}
      >
        {/* Spine highlight */}
        <div
          className="absolute left-0 top-0 bottom-0 w-4"
          style={{ background: "rgba(255,255,255,0.07)" }}
        />
        {/* Cover texture overlay */}
        <div
          className="absolute inset-0"
          style={{ background: "rgba(0,0,0,0.08)", mixBlendMode: "multiply" }}
        />
        {/* Journal label */}
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <p
            className="text-base font-script leading-tight"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {journal.label}
          </p>
          <p
            className="text-[10px] mt-1 font-mono uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            {journal.description}
          </p>
        </div>
      </div>

      {/* "open →" hint */}
      <AnimatePresence>
        {hovered && (
          <motion.p
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute -bottom-6 right-0 text-[10px] font-mono whitespace-nowrap"
            style={{ color: "var(--notebook-text-muted)" }}
          >
            open →
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function JournalDesk() {
  const [activeJournal, setActiveJournal] = useState<Journal | null>(null);
  const router = useRouter();

  const handleOpen = (id: Journal) => {
    setActiveJournal(id);
    // Brief delay to let the expand animation play, then navigate
    setTimeout(() => router.push(`/notebook/${id}`), 300);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Desk grain texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E\")",
          backgroundSize: "200px 200px",
        }}
      />

      {/* Back link (when navigating from a journal) */}
      <div className="relative z-10 px-6 pt-6">
        <a
          href="/"
          className="text-xs font-mono transition-colors duration-150"
          style={{ color: "var(--notebook-text-muted)" }}
        >
          ← hzy
        </a>
      </div>

      {/* Desk area */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6">
        <p
          className="text-xs font-mono uppercase tracking-widest mb-16 text-center"
          style={{ color: "var(--notebook-text-muted)" }}
        >
          notebook
        </p>

        {/* Journals scattered on desk — desktop */}
        <div className="hidden md:flex items-end justify-center gap-6 relative" style={{ height: 280 }}>
          {JOURNALS.map((j) => (
            <JournalCard key={j.id} journal={j} onOpen={handleOpen} />
          ))}
        </div>

        {/* Journals stacked — mobile */}
        <div className="flex md:hidden flex-col gap-4 w-full max-w-xs">
          {JOURNALS.map((j) => (
            <motion.div
              key={j.id}
              className="cursor-pointer"
              whileTap={{ scale: 0.97 }}
              onClick={() => handleOpen(j.id)}
            >
              <div
                className="flex items-center gap-3 p-4 rounded-lg"
                style={{ background: j.color }}
              >
                <div>
                  <p className="text-sm font-script" style={{ color: "rgba(255,255,255,0.92)" }}>
                    {j.label}
                  </p>
                  <p
                    className="text-[10px] font-mono uppercase tracking-wider mt-0.5"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    {j.description}
                  </p>
                </div>
                <span className="ml-auto text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                  →
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

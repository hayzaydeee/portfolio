"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

/* ── Quick-nav card data ──────────────────────────────────────────── */

const CARDS = [
  {
    href: "/work",
    label: "work",
    subtitle: "projects & process",
    accent: "var(--workshop-syntax)",
    ambient: "workshop" as const,
  },
  {
    href: "/notebook",
    label: "journal",
    subtitle: "thoughts & essays",
    accent: "var(--notebook-reflections)",
    ambient: "notebook" as const,
  },
  {
    href: "/music",
    label: "music",
    subtitle: "production & playlists",
    accent: "var(--studio-accent-light)",
    ambient: "studio" as const,
  },
  {
    href: "/wall",
    label: "art",
    subtitle: "photography & visuals",
    accent: "var(--wall-pin)",
    ambient: "wall" as const,
  },
] as const;

/* ── Ambient card visuals ─────────────────────────────────────────── */

function WorkshopAmbient() {
  return (
    <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] leading-4 opacity-20 pointer-events-none select-none"
      style={{ color: "var(--workshop-text-muted)" }}
    >
      <div>
        {["src/", "  lib/", "    utils.ts", "  components/", "    Hero.tsx"].map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function NotebookAmbient() {
  return (
    <div className="absolute inset-0 flex items-end justify-center pb-4 px-3 pointer-events-none select-none">
      <p className="font-serif text-[10px] italic leading-4 text-center opacity-25"
        style={{ color: "var(--notebook-text-muted)" }}
      >
        the light that makes sight possible is not itself always seen
      </p>
    </div>
  );
}

function StudioAmbient() {
  return (
    <svg
      viewBox="0 0 80 32"
      className="absolute inset-0 w-full h-full p-4 opacity-15 pointer-events-none"
      aria-hidden="true"
    >
      {Array.from({ length: 20 }, (_, i) => {
        const h = 3 + Math.sin(i * 0.8) * 10 + Math.sin(i * 1.5) * 6;
        return (
          <rect
            key={i}
            x={i * 4}
            y={(32 - h) / 2}
            width="2.5"
            height={h}
            rx="1"
            fill="var(--studio-accent-light)"
          />
        );
      })}
    </svg>
  );
}

function WallAmbient() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
      <div
        className="w-10 h-12 border rounded-sm opacity-20"
        style={{ borderColor: "var(--wall-caption)" }}
      />
    </div>
  );
}

const AMBIENT_MAP = {
  workshop: WorkshopAmbient,
  notebook: NotebookAmbient,
  studio: StudioAmbient,
  wall: WallAmbient,
} as const;

/* ── Quick-nav card ───────────────────────────────────────────────── */

function QuickNavCard({
  href,
  label,
  subtitle,
  accent,
  ambient,
  index,
  sequenceMode,
}: (typeof CARDS)[number] & { index?: number; sequenceMode?: boolean }) {
  const Ambient = AMBIENT_MAP[ambient];

  const card = (
    <Link href={href} className="group block">
      <motion.div
        className="relative overflow-hidden rounded-lg border border-white/5 bg-(--lobby-card) p-5 h-28 md:h-32 flex flex-col justify-end"
        whileHover={{ scale: 1.03 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <Ambient />

        {/* Label */}
        <span
          className="relative z-10 text-lg font-sans font-medium tracking-tight text-(--lobby-text)"
        >
          {label}
        </span>

        {/* Subtitle — reveal on card hover via group */}
        <span
          className="relative z-10 text-xs font-sans mt-1 block max-h-0 opacity-0 overflow-hidden transition-all duration-200 ease-out group-hover:max-h-6 group-hover:opacity-100"
          style={{ color: accent }}
        >
          {subtitle}
        </span>
      </motion.div>
    </Link>
  );

  if (sequenceMode && index !== undefined) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.1, duration: 0.3 }}
      >
        {card}
      </motion.div>
    );
  }

  return card;
}

/* ── Scroll nudge ─────────────────────────────────────────────────── */

function ScrollNudge() {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.2, duration: 0.6 }}
    >
      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <ChevronDown size={20} className="text-(--lobby-accent) opacity-60" />
      </motion.div>
    </motion.div>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────── */

export function Hero({ mode = "resting" }: { mode?: "sequence" | "resting" }) {
  const isSequence = mode === "sequence";
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <section
      ref={sectionRef}
      className={`relative flex items-center overflow-hidden bg-(--lobby-surface) ${
        isSequence ? "min-h-screen justify-center" : "min-h-[calc(100vh-3.5rem)]"
      }`}
    >
      <motion.div
        className="relative z-10 max-w-5xl mx-auto w-full px-6 py-20"
        style={isSequence ? undefined : { y: textY }}
      >
        <SectionHeading>HERO</SectionHeading>

        <h1 className="text-5xl md:text-7xl font-sans text-(--lobby-text) tracking-tight mb-3">
          Divine Eze
        </h1>
        <p className="text-base md:text-lg font-sans text-text-muted mb-12">
          software engineer. musician. writer.
        </p>

        <nav aria-label="room navigation">
          <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 list-none m-0 p-0">
            {CARDS.map((card, i) => (
              <li key={card.href}>
                <QuickNavCard {...card} index={i} sequenceMode={isSequence} />
              </li>
            ))}
          </ul>
        </nav>
      </motion.div>

      {!isSequence && <ScrollNudge />}
    </section>
  );
}

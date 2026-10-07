"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { TransitionLink } from "@/components/fx/ui/TransitionLink";
import type { RoomKey } from "@/components/fx/runtime/types";
import { SectionHeading } from "./SectionHeading";
import { useLobbyBackdrop } from "./LobbyBackdrop";

/* ── Quick-nav card data ──────────────────────────────────────────── */

type RoomCard = {
  href: string;
  label: string;
  subtitle: string;
  room: Exclude<RoomKey, "lobby">;
};

const CARDS: readonly RoomCard[] = [
  { href: "/work", label: "work", subtitle: "projects & process", room: "workshop" },
  { href: "/notebook", label: "journal", subtitle: "thoughts & essays", room: "notebook" },
  { href: "/music", label: "music", subtitle: "production & playlists", room: "studio" },
  { href: "/wall", label: "art", subtitle: "photography & visuals", room: "wall" },
];

/* ── Ambient card visuals ─────────────────────────────────────────── */

function WorkshopAmbient() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[10px] leading-4 text-(--workshop-text-muted) opacity-20 select-none">
      <div>
        {["src/", "  lib/", "    utils.ts", "  components/", "    Hero.tsx"].map((l) => (
          <div key={l} className="whitespace-pre">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function NotebookAmbient() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center px-3 pb-4 select-none">
      <p className="text-center font-serif text-[10px] leading-4 text-(--notebook-text-muted) italic opacity-25">
        the light that makes sight possible is not itself always seen
      </p>
    </div>
  );
}

const BARS = Array.from({ length: 20 }, (_, i) => Math.max(2, 3 + Math.sin(i * 0.8) * 10 + Math.sin(i * 1.5) * 6));

function StudioAmbient() {
  return (
    <svg viewBox="0 0 80 32" className="pointer-events-none absolute inset-0 size-full p-4 opacity-15" aria-hidden="true">
      {BARS.map((h, i) => (
        <rect key={i} x={i * 4} y={(32 - h) / 2} width="2.5" height={h} rx="1" className="fill-(--studio-accent-light)" />
      ))}
    </svg>
  );
}

function WallAmbient() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center select-none">
      <div className="h-12 w-10 rounded-sm border border-(--wall-caption) opacity-20" />
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

function QuickNavCard({ href, label, subtitle, room }: RoomCard) {
  const Ambient = AMBIENT_MAP[room];
  const { command } = useLobbyBackdrop();
  // Pointing at a room leans the horizon toward its palette; letting go brings it home
  const lean = () => command("tint", room);
  const release = () => command("tint", null);

  return (
    <TransitionLink
      href={href}
      className="room-card prim"
      data-room={room}
      onPointerEnter={lean}
      onPointerLeave={release}
      onFocus={lean}
      onBlur={release}
    >
      <span className="room-card__beam" aria-hidden="true" />
      <span className="room-card__face">
        <Ambient />
        <span className="relative z-10 font-sans text-lg font-medium tracking-tight text-(--lobby-text)">{label}</span>
        <span className="room-card__sub relative z-10 mt-1 font-sans text-xs">{subtitle}</span>
      </span>
    </TransitionLink>
  );
}

/* ── Scroll nudge ─────────────────────────────────────────────────── */

function ScrollNudge() {
  return (
    <motion.div
      className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.2, duration: 0.6 }}
    >
      <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
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
      className={`relative flex items-center overflow-hidden ${
        isSequence ? "min-h-screen justify-center" : "min-h-[calc(100vh-3.5rem)]"
      }`}
    >
      <motion.div
        className="relative z-10 mx-auto w-full max-w-5xl px-6 py-20"
        style={isSequence ? undefined : { y: textY }}
      >
        <SectionHeading>HERO</SectionHeading>

        <h1 className="mb-3 font-sans text-5xl tracking-tight text-(--lobby-text) md:text-7xl">Divine Eze</h1>
        <p className="mb-12 font-sans text-base text-text-muted md:text-lg">software engineer. musician. writer.</p>

        <nav aria-label="room navigation">
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4">
            {CARDS.map((card, i) => (
              <li key={card.href}>
                {isSequence ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.3 }}
                  >
                    <QuickNavCard {...card} />
                  </motion.div>
                ) : (
                  <QuickNavCard {...card} />
                )}
              </li>
            ))}
          </ul>
        </nav>
      </motion.div>

      {!isSequence && <ScrollNudge />}
    </section>
  );
}

"use client";

import { useRef } from "react";
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import {
  SiJavascript,
  SiTypescript,
  SiReact,
  SiNodedotjs,
  SiExpress,
  SiMongodb,
  SiPython,
  SiKotlin,
} from "@icons-pack/react-simple-icons";
import type { FxHandle } from "@/components/fx/FxStage";
import { IconOrb } from "@/components/fx/ui/IconOrb";
import { SectionHeading } from "./SectionHeading";
import { useSectionProgress, type LobbyMode } from "./sectionProgress";

type Item = {
  word: string;
  Icon?: React.ComponentType<{ size?: number; className?: string; title?: string }>;
  /** Plain words dim once the icons resolve, unless kept */
  keep?: boolean;
};

const WORDS: Item[] = [
  { word: "I" },
  { word: "work" },
  { word: "primarily" },
  { word: "in" },
  { word: "JavaScript", Icon: SiJavascript },
  { word: "·" },
  { word: "React,", Icon: SiReact },
  { word: "Node,", Icon: SiNodedotjs },
  { word: "Express,", Icon: SiExpress },
  { word: "MongoDB", Icon: SiMongodb },
  { word: "·" },
  { word: "with" },
  { word: "experience" },
  { word: "in" },
  { word: "Kotlin,", Icon: SiKotlin },
  { word: "C++,", keep: true },
  { word: "TypeScript,", Icon: SiTypescript },
  { word: "and" },
  { word: "Python.", Icon: SiPython },
];

/** Progress marks: words arrive by 0.42 (each over 0.08, so the last lands before 0.5), then the icon words turn into orbs */
const ARRIVE_END = 0.42;
const MORPH = [0.55, 0.75] as const;

function Word({ item, index, progress, orb }: { item: Item; index: number; progress: MotionValue<number>; orb: (el: FxHandle | null) => void }) {
  const appearStart = (index / WORDS.length) * ARRIVE_END;
  const opacity = useTransform(progress, [appearStart, appearStart + 0.08, 0.5, 0.8], [0, 1, 1, item.Icon || item.keep ? 1 : 0.3]);
  const y = useTransform(progress, [appearStart, appearStart + 0.08], [8, 0]);

  // The word blurs away as its orb gathers out of the same spot
  const textOpacity = useTransform(progress, [MORPH[0], MORPH[1] - 0.05], [1, 0]);
  const textBlur = useTransform(progress, [MORPH[0], MORPH[1]], ["blur(0px)", "blur(6px)"]);
  const orbOpacity = useTransform(progress, [MORPH[0] + 0.03, MORPH[1]], [0, 1]);
  const orbScale = useTransform(progress, [MORPH[0], MORPH[1]], [0.4, 1]);

  if (!item.Icon) {
    return (
      <motion.span className="inline-block" style={{ opacity, y }}>
        {item.word}
      </motion.span>
    );
  }

  return (
    <motion.span className="relative inline-grid place-items-center" style={{ opacity, y }} data-tech-word={item.word}>
      <motion.span style={{ opacity: textOpacity, filter: textBlur }}>{item.word}</motion.span>
      <motion.span
        className="absolute top-1/2 left-1/2 -translate-1/2"
        style={{ opacity: orbOpacity, scale: orbScale }}
      >
        <IconOrb Icon={item.Icon} room="lobby" className="size-14 md:size-16" handle={orb} />
      </motion.span>
    </motion.span>
  );
}

export function TechStack({ mode = "resting" }: { mode?: LobbyMode }) {
  const isSequence = mode === "sequence";
  const containerRef = useRef<HTMLElement>(null);
  const progress = useSectionProgress(mode, containerRef, {
    offset: ["start start", "end end"],
    duration: 3.6,
    ease: "linear",
  });

  // Each orb lets off a ring of light as the morph lands, left to right
  const orbs = useRef<(FxHandle | null)[]>([]);
  const landed = useRef(false);
  useMotionValueEvent(progress, "change", (v) => {
    const now = v >= MORPH[1];
    if (now && !landed.current) {
      orbs.current.forEach((orb, i) => {
        if (orb) setTimeout(() => orb.command("pulse"), i * 90);
      });
    }
    landed.current = now;
  });

  const sentence = (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-6 font-sans text-2xl leading-tight text-(--lobby-text) md:gap-x-4 md:text-4xl">
      {WORDS.map((item, i) => (
        <Word
          key={`${item.word}-${i}`}
          item={item}
          index={i}
          progress={progress}
          orb={(el) => {
            orbs.current[i] = el;
          }}
        />
      ))}
    </p>
  );

  if (isSequence) {
    return (
      <section ref={containerRef} className="flex min-h-screen items-center justify-center px-6">
        <div className="mx-auto w-full max-w-5xl">
          <SectionHeading>TECH STACK</SectionHeading>
          {sentence}
        </div>
      </section>
    );
  }

  return (
    <section ref={containerRef} className="relative h-[180vh]">
      <div className="sticky top-0 flex h-screen items-center px-6">
        <div className="mx-auto w-full max-w-5xl">
          <SectionHeading>TECH STACK</SectionHeading>
          {sentence}
        </div>
      </div>
    </section>
  );
}

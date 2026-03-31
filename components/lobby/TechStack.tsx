"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";
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

const ICON_SIZE = 20;

const WORDS: Array<{
  word: string;
  Icon?: React.ComponentType<{ size: number; className?: string }>;
  keep?: boolean;
}> = [
  { word: "I", keep: false },
  { word: "work", keep: false },
  { word: "primarily", keep: false },
  { word: "in", keep: false },
  { word: "JavaScript", Icon: SiJavascript },
  { word: "—", keep: false },
  { word: "React,", Icon: SiReact },
  { word: "Node,", Icon: SiNodedotjs },
  { word: "Express,", Icon: SiExpress },
  { word: "MongoDB", Icon: SiMongodb },
  { word: "—", keep: false },
  { word: "with", keep: false },
  { word: "experience", keep: false },
  { word: "in", keep: false },
  { word: "Kotlin,", Icon: SiKotlin },
  { word: "C++,", keep: true },
  { word: "TypeScript,", Icon: SiTypescript },
  { word: "and", keep: false },
  { word: "Python.", Icon: SiPython },
];

/* ── Scroll-driven word ───────────────────────────────────────────── */

function Word({
  item,
  index,
  total,
  progress,
}: {
  item: (typeof WORDS)[number];
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const hasIcon = !!item.Icon;
  const fadeOut = !hasIcon && item.keep !== true;

  // Phase 1 (0–0.5): all words appear in sequence
  const appearStart = (index / total) * 0.5;
  const appearEnd = appearStart + 0.08;
  const wordOpacity = useTransform(progress, [appearStart, appearEnd], [0, 1]);
  const wordY = useTransform(progress, [appearStart, appearEnd], [6, 0]);

  // Phase 2 (0.5–0.8): non-icon words fade, icons resolve
  const settleOpacity = useTransform(
    progress,
    [0.5, 0.8],
    [1, fadeOut ? 0.3 : 1]
  );

  // Combine: word appears then optionally fades
  const combinedOpacity = useTransform(
    () => wordOpacity.get() * settleOpacity.get()
  );

  // Icon visibility tied to settle phase
  const iconOpacity = useTransform(progress, [0.55, 0.75], [0, 1]);

  return (
    <motion.span
      className="inline-flex items-center gap-1"
      style={{ opacity: combinedOpacity, y: wordY }}
    >
      {hasIcon && item.Icon ? (
        <>
          {/* Text form visible pre-settle */}
          <motion.span
            className="text-base font-sans text-(--lobby-text)"
            style={{ opacity: useTransform(iconOpacity, (v) => 1 - v) }}
          >
            {item.word}
          </motion.span>
          {/* Icon form visible post-settle */}
          <motion.span style={{ opacity: iconOpacity, position: "absolute" }}>
            <item.Icon size={ICON_SIZE} className="text-(--lobby-text)" />
          </motion.span>
        </>
      ) : (
        <span
          className={cn(
            "text-base font-sans text-(--lobby-text)"
          )}
        >
          {item.word}
        </span>
      )}
    </motion.span>
  );
}

/* ── Timed sequence word ──────────────────────────────────────────── */

function SequenceWord({
  item,
  index,
  total,
}: {
  item: (typeof WORDS)[number];
  index: number;
  total: number;
}) {
  const hasIcon = !!item.Icon;
  const fadeOut = !hasIcon && item.keep !== true;

  return (
    <motion.span
      className="inline-flex items-center gap-1 relative"
      initial={{ opacity: 0, y: 6 }}
      animate={{
        opacity: fadeOut ? [0, 1, 0.3] : 1,
        y: 0,
      }}
      transition={{
        delay: (index / total) * 2,
        duration: 0.4,
      }}
    >
      {hasIcon && item.Icon ? (
        <>
          <motion.span
            className="text-base font-sans text-(--lobby-text)"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ delay: 2.5, duration: 0.3 }}
          >
            {item.word}
          </motion.span>
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5, duration: 0.3 }}
            style={{ position: "absolute" }}
          >
            <item.Icon size={ICON_SIZE} className="text-(--lobby-text)" />
          </motion.span>
        </>
      ) : (
        <span className="text-base font-sans text-(--lobby-text)">
          {item.word}
        </span>
      )}
    </motion.span>
  );
}

/* ── TechStack ────────────────────────────────────────────────────── */

export function TechStack({ mode = "resting" }: { mode?: "sequence" | "resting" }) {
  const isSequence = mode === "sequence";
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.8", "end 0.2"],
  });

  if (isSequence) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-(--lobby-surface) px-6">
        <div className="max-w-5xl mx-auto w-full">
          <SectionHeading>TECH STACK</SectionHeading>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {WORDS.map((item, i) => (
              <SequenceWord
                key={`${item.word}-${i}`}
                item={item}
                index={i}
                total={WORDS.length}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div ref={containerRef} className="min-h-[60vh]">
      <section className="sticky top-0 bg-(--lobby-surface) py-20 px-6 flex items-center min-h-[50vh]">
        <div className="max-w-5xl mx-auto w-full">
          <SectionHeading>TECH STACK</SectionHeading>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {WORDS.map((item, i) => (
              <Word
                key={`${item.word}-${i}`}
                item={item}
                index={i}
                total={WORDS.length}
                progress={scrollYProgress}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

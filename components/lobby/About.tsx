"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { SectionHeading } from "./SectionHeading";

/* ── Phrase chunks for karaoke highlight ──────────────────────────── */

const PHRASES = [
  "I'm a software engineering student",
  "at the University of Northampton",
  "and a builder by instinct.",
  "I make things across software,",
  "music, and writing —",
  "sometimes they overlap.",
  "I'm currently looking",
  "for engineering internships",
  "where I can contribute",
  "to something real.",
];

/* ── Social links ─────────────────────────────────────────────────── */

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com/hayzaydee" },
  { label: "TikTok", href: "https://tiktok.com/@hayzaydee" },
  { label: "YouTube", href: "https://youtube.com/@hayzaydee" },
  { label: "Substack", href: "https://hayzaydee.substack.com" },
];

/* ── Scroll-driven highlighted phrase ─────────────────────────────── */

function ScrollPhrase({
  text,
  index,
  total,
  progress,
}: {
  text: string;
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
}) {
  const start = index / total;
  const end = (index + 1) / total;

  const opacity = useTransform(progress, [start, end], [0.2, 1]);
  const color = useTransform(
    progress,
    [start, end],
    ["var(--lobby-text)", "var(--lobby-accent)"]
  );

  return (
    <motion.span style={{ opacity, color }} className="transition-none">
      {text}{" "}
    </motion.span>
  );
}

/* ── Timed sequence phrase ────────────────────────────────────────── */

function SequencePhrase({ text, index }: { text: string; index: number }) {
  return (
    <motion.span
      initial={{ opacity: 0.2 }}
      animate={{ opacity: 1, color: "var(--lobby-accent)" }}
      transition={{ delay: index * 0.3, duration: 0.3 }}
      className="transition-none"
      style={{ color: "var(--lobby-text)" }}
    >
      {text}{" "}
    </motion.span>
  );
}

/* ── About section ────────────────────────────────────────────────── */

export function About({ mode = "resting" }: { mode?: "sequence" | "resting" }) {
  const isSequence = mode === "sequence";
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.7", "end 0.4"],
  });

  const socialsOpacity = useTransform(scrollYProgress, [0.85, 1], [0, 1]);

  return (
    <section
      ref={sectionRef}
      className={`bg-(--lobby-surface-deep) px-6 ${
        isSequence
          ? "min-h-screen flex items-center justify-center"
          : "py-32 md:py-40"
      }`}
    >
      <div className="max-w-2xl mx-auto">
        <SectionHeading>ABOUT</SectionHeading>

        <p className="text-lg md:text-xl font-sans leading-[1.75] tracking-[-0.01em]">
          {isSequence
            ? PHRASES.map((phrase, i) => (
                <SequencePhrase key={i} text={phrase} index={i} />
              ))
            : PHRASES.map((phrase, i) => (
                <ScrollPhrase
                  key={i}
                  text={phrase}
                  index={i}
                  total={PHRASES.length}
                  progress={scrollYProgress}
                />
              ))}
        </p>

        {/* Social links */}
        <motion.div
          className="mt-10 flex gap-5"
          style={isSequence ? undefined : { opacity: socialsOpacity }}
          initial={isSequence ? { opacity: 0 } : false}
          animate={isSequence ? { opacity: 1 } : undefined}
          transition={isSequence ? { delay: PHRASES.length * 0.3, duration: 0.4 } : undefined}
        >
          {SOCIALS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-sans text-(--lobby-accent) hover:text-(--lobby-text) underline underline-offset-4 transition-colors"
            >
              {label}
            </a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

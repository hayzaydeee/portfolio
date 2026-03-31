"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { SectionHeading } from "./SectionHeading";
import {
  SiInstagram,
  SiTiktok,
  SiYoutube,
  SiSubstack,
} from "@icons-pack/react-simple-icons";

/* ── Word-by-word karaoke highlight ───────────────────────────────── */

const BIO_TEXT =
  "I'm Nigerian by descent, based in Northampton, UK, and focused on building software with genuine utility across the domains I care about: developer productivity, personal wellness, sports, consumer experiences, and the tools that sit underneath all of it. This site is where the software and everything else — music, art, writing — lives together. I also make content, so you can check that out on all the different platforms!";

const WORDS = BIO_TEXT.split(" ");

/** Punctuation at end of word = slight pause in sequence timing */
function pauseWeight(word: string): number {
  if (word.endsWith(".") || word.endsWith("!")) return 3.5;
  if (word.endsWith(":") || word.endsWith("—")) return 2.5;
  if (word.endsWith(",")) return 1.8;
  return 1;
}

/** Cumulative delay for sequence mode, accounting for punctuation pauses */
function getCumulativeDelay(index: number): number {
  const BASE = 0.2;
  let total = 0;
  for (let i = 0; i < index; i++) {
    total += BASE * pauseWeight(WORDS[i]);
  }
  return total;
}

const TOTAL_SEQUENCE_DURATION = getCumulativeDelay(WORDS.length);

/* ── Social links ─────────────────────────────────────────────────── */

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com/hayzaydee", Icon: SiInstagram },
  { label: "TikTok", href: "https://tiktok.com/@hayzaydee", Icon: SiTiktok },
  { label: "YouTube", href: "https://youtube.com/@hayzaydee", Icon: SiYoutube },
  { label: "Substack", href: "https://hayzaydee.substack.com", Icon: SiSubstack },
];

/* ── Scroll-driven highlighted word ───────────────────────────────── */

function ScrollWord({
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

/* ── Timed sequence word ──────────────────────────────────────────── */

function SequenceWord({ text, index }: { text: string; index: number }) {
  return (
    <motion.span
      initial={{ opacity: 0.2 }}
      animate={{ opacity: 1, color: "var(--lobby-accent)" }}
      transition={{ delay: getCumulativeDelay(index), duration: 0.15 }}
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
    offset: ["start 0.9", "end 0.2"],
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
            ? WORDS.map((word, i) => (
                <SequenceWord key={i} text={word} index={i} />
              ))
            : WORDS.map((word, i) => (
                <ScrollWord
                  key={i}
                  text={word}
                  index={i}
                  total={WORDS.length}
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
          transition={isSequence ? { delay: TOTAL_SEQUENCE_DURATION + 0.3, duration: 0.4 } : undefined}
        >
          {SOCIALS.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-sans text-(--lobby-accent) hover:text-(--lobby-text) transition-colors"
            >
              <Icon size={14} />
              {label}
            </a>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

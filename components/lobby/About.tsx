"use client";

import { useRef } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { SiInstagram, SiTiktok, SiYoutube, SiSubstack } from "@icons-pack/react-simple-icons";
import { FxStage } from "@/components/fx/FxStage";
import { SectionHeading } from "./SectionHeading";
import { useSectionProgress, type LobbyMode } from "./sectionProgress";

/* ── Word-by-word karaoke highlight ───────────────────────────────── */

const BIO_TEXT =
  "I'm Nigerian by descent, based in Northampton, UK, and focused on building software with genuine utility across the domains I care about: developer productivity, personal wellness, sports, consumer experiences, and the tools that sit underneath all of it. This site is where the software and everything else (music, art, writing) lives together. I also make content, so you can check that out on all the different platforms!";

const WORDS = BIO_TEXT.split(" ");

/** Punctuation at the end of a word holds the highlight a little longer */
function pauseWeight(word: string): number {
  if (word.endsWith(".") || word.endsWith("!")) return 3.5;
  if (word.endsWith(":") || word.endsWith(")")) return 2.5;
  if (word.endsWith(",")) return 1.8;
  return 1;
}

/** Where each word starts on the 0..1 progress, punctuation pauses included */
const STARTS = WORDS.reduce<number[]>((acc, word, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + pauseWeight(WORDS[i - 1]));
  return acc;
}, []);
const TOTAL_WEIGHT = STARTS[STARTS.length - 1] + pauseWeight(WORDS[WORDS.length - 1]);
/** Seconds the sequence takes to read the paragraph */
const SEQUENCE_SECONDS = TOTAL_WEIGHT * 0.2;

/* ── Social links ─────────────────────────────────────────────────── */

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com/hayzaydee", Icon: SiInstagram },
  { label: "TikTok", href: "https://tiktok.com/@hayzaydee", Icon: SiTiktok },
  { label: "YouTube", href: "https://youtube.com/@hayzaydee", Icon: SiYoutube },
  { label: "Substack", href: "https://hayzaydee.substack.com", Icon: SiSubstack },
];

/* ── One highlighted word ─────────────────────────────────────────── */

function Word({ text, index, progress }: { text: string; index: number; progress: MotionValue<number> }) {
  // The paragraph is read in the first 85%; the socials take the rest
  const start = (STARTS[index] / TOTAL_WEIGHT) * 0.85;
  const end = ((STARTS[index] + pauseWeight(text)) / TOTAL_WEIGHT) * 0.85;
  const opacity = useTransform(progress, [start, end], [0.2, 1]);
  const color = useTransform(progress, (v) => (v >= start ? "var(--lobby-accent)" : "var(--lobby-text)"));

  return (
    <motion.span style={{ opacity, color }}>
      {text}{" "}
    </motion.span>
  );
}

/* ── About section ────────────────────────────────────────────────── */

export function About({ mode = "resting" }: { mode?: LobbyMode }) {
  const isSequence = mode === "sequence";
  const sectionRef = useRef<HTMLElement>(null);
  const progress = useSectionProgress(mode, sectionRef, {
    offset: ["start 0.9", "end 0.2"],
    duration: SEQUENCE_SECONDS,
    ease: "linear",
  });
  const socialsOpacity = useTransform(progress, [0.86, 1], [0, 1]);

  return (
    <section
      ref={sectionRef}
      className={`px-6 ${isSequence ? "flex min-h-screen items-center justify-center" : "py-32 md:py-40"}`}
    >
      <div className="mx-auto grid w-full max-w-5xl items-center gap-12 md:grid-cols-[3fr_2fr]">
        <div>
          <SectionHeading>ABOUT</SectionHeading>

          <p className="font-sans text-lg leading-[1.75] tracking-[-0.01em] md:text-xl">
            {WORDS.map((word, i) => (
              <Word key={i} text={word} index={i} progress={progress} />
            ))}
          </p>

          <motion.div className="mt-10 flex flex-wrap gap-5" style={{ opacity: socialsOpacity }}>
            {SOCIALS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-sans text-sm text-(--lobby-accent) transition-colors hover:text-(--lobby-text)"
              >
                <Icon size={14} />
                {label}
              </a>
            ))}
          </motion.div>
        </div>

        {/* A sphere spun from the bio's own letters; knock some loose and they grow back */}
        <figure className="mx-auto w-full max-w-sm md:max-w-none">
          <div className="relative aspect-square w-full cursor-crosshair" data-about-sphere="">
            <FxStage
              slot="lobby.about"
              options={{ text: BIO_TEXT }}
              className="absolute inset-0"
              posterClassName="bg-transparent"
            />
          </div>
          <figcaption className="mt-2 text-center font-mono text-xs text-text-muted">
            knock a few letters loose. they grow back.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

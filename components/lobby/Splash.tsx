"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HzyMark } from "@/components/nav/HzyMark";

const SENTENCE_PARTS = [
  "hey, i'm Divine —",
  "i build software, make music, and write when my mind won't quiet down.",
  "i'm glad you're here.",
];

interface SplashProps {
  onDismiss: () => void;
}

export function Splash({ onDismiss }: SplashProps) {
  const [phase, setPhase] = useState<"mark" | "text" | "cta" | "done">("mark");

  // Animate through phases: mark reveal → sentence → cta
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setPhase("cta");
      return;
    }
    // Mark reveal: 1500ms
    const t1 = setTimeout(() => setPhase("text"), 1700); // 1500ms anim + 200ms pause
    // Sentence: 600ms stagger
    const t2 = setTimeout(() => setPhase("cta"), 1700 + 600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <motion.div
      key="splash"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-(--lobby-surface)"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
    >
      {/* hzy mark — layoutId matches Nav so it flies to nav position on dismiss */}
      <motion.div
        layoutId="hzy-mark"
        animate={phase !== "mark" ? { y: -4, scale: 1.02 } : {}}
        transition={{ duration: 0.2 }}
        className="mb-8"
      >
        <HzyMark mode="dark" size={72} animate={true} />
      </motion.div>

      {/* Intro sentence */}
      <AnimatePresence>
        {(phase === "text" || phase === "cta") && (
          <motion.p
            key="sentence"
            className="max-w-sm text-center text-base font-sans text-(--lobby-text) leading-relaxed px-6"
          >
            {SENTENCE_PARTS.map((part, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.18, duration: 0.35, ease: "easeOut" }}
                className="inline"
              >
                {part}{" "}
              </motion.span>
            ))}
          </motion.p>
        )}
      </AnimatePresence>

      {/* CTA */}
      <AnimatePresence>
        {phase === "cta" && (
          <motion.button
            key="cta"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={onDismiss}
            className="mt-8 text-sm font-sans text-(--color-accent) hover:text-(--color-accent-light) transition-colors cursor-pointer"
          >
            let&apos;s go →
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

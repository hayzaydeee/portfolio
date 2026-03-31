"use client";

import { motion } from "motion/react";

type TourNudgeProps = {
  onStart: () => void;
  onDecline?: () => void;
  mode?: "sequence" | "resting";
};

export function TourNudge({ onStart, onDecline, mode = "resting" }: TourNudgeProps) {
  const isSequence = mode === "sequence";

  return (
    <motion.section
      className={`bg-(--lobby-surface) px-6 text-center ${
        isSequence ? "min-h-screen flex flex-col items-center justify-center" : "py-16"
      }`}
      initial={{ opacity: 0 }}
      {...(isSequence
        ? { animate: { opacity: 1 }, transition: { duration: 0.6 } }
        : {
            whileInView: { opacity: 1 },
            viewport: { once: true, margin: "-40px" },
            transition: { duration: 0.6 },
          })}
    >
      <p className="text-sm font-sans text-text-muted mb-4">
        want to see the whole place?
      </p>
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={onStart}
          aria-label="start guided tour"
          className="inline-flex items-center gap-2 text-sm font-sans text-(--lobby-accent) hover:text-accent-light transition-colors cursor-pointer"
        >
          <span>take the tour</span>
          <span aria-hidden="true" className="text-base">→</span>
        </button>
        {isSequence && onDecline && (
          <button
            type="button"
            onClick={onDecline}
            className="text-sm font-sans text-text-muted hover:text-(--lobby-text) transition-colors cursor-pointer"
          >
            skip
          </button>
        )}
      </div>
    </motion.section>
  );
}

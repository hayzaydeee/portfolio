"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HzyMark } from "@/components/nav/HzyMark";

/* ── Types & Constants ──────────────────────────────────────────────── */

type Phase =
  | "loading"
  | "logo"
  | "greeting"
  | "typewriter"
  | "cta"
  | "exit";

const PHASE_ORDER: Phase[] = [
  "loading",
  "logo",
  "greeting",
  "typewriter",
  "cta",
  "exit",
];

/** Typewriter sentence as a flat string. */
const TYPEWRITER_TEXT =
  "i build software, make art, and write when my mind won't quiet down. i'm glad you're here.";

/** Segments with formatting metadata for the typewriter. */
type Segment = { text: string; italic?: boolean; bold?: boolean };
const TYPEWRITER_SEGMENTS: Segment[] = [
  { text: "i build " },
  { text: "software", italic: true },
  { text: ", make " },
  { text: "art", italic: true },
  { text: ", and " },
  { text: "write", italic: true },
  { text: " when my mind won't quiet down. " },
  { text: "i'm glad you're here.", bold: true },
];

/* ── Timing constants (ms) ──────────────────────────────────────────── */
const LOAD_MIN_TIME = 2500;
const COUNTER_HOLD = 350;
const LOGO_REVEAL_DUR = 2000;
const LOGO_HOLD = 500;
const LOGO_SETTLE_DUR = 800;
const GREETING_DUR = 700;
const CHAR_DELAY = 42;
const POST_TYPE_DELAY = 400;
const SENTENCE_PAUSE = 600;
const BORDER_DRAW_DUR = 600;
const UNDERLINE_DUR = 500;
const UNDERLINE_DELAY = 200;
const SKIP_APPEAR_DELAY = 2000;
const LOGO_FLY_DUR = 1.0;
const EXIT_DUR = 0.8;

/** Index where "i'm glad you're here." begins in TYPEWRITER_TEXT */
const GLAD_START = TYPEWRITER_TEXT.indexOf("i'm glad you're here.");

/* ── Component ──────────────────────────────────────────────────────── */

interface SplashProps {
  onDismiss: () => void;
}

export function Splash({ onDismiss }: SplashProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [typedCount, setTypedCount] = useState(0);
  const [borderProgress, setBorderProgress] = useState(0);
  const [logoSettled, setLogoSettled] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  /** Exit sub-phases: "fly" = logo translating, "colors" = bg + fill transition */
  const [exitStage, setExitStage] = useState<"idle" | "fly" | "colors">("idle");
  const [logoMode, setLogoMode] = useState<"light" | "dark">("light");

  const counterRef = useRef<HTMLSpanElement>(null);
  const counterContainerRef = useRef<HTMLDivElement>(null);
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const skipTriggeredRef = useRef(false);

  const initialLogoSize = useRef(
    typeof window !== "undefined"
      ? Math.min(window.innerWidth * 0.45, 600)
      : 400
  ).current;

  /* ── Timeout helpers ──────────────────────────────────────────────── */

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach((id) => clearTimeout(id));
    timeoutsRef.current = [];
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /** Phase index helper for conditional rendering. */
  const atLeast = (p: Phase) =>
    PHASE_ORDER.indexOf(phase) >= PHASE_ORDER.indexOf(p);

  /* ── Skip ─────────────────────────────────────────────────────────── */

  const handleSkip = useCallback(() => {
    if (skipTriggeredRef.current) return;
    skipTriggeredRef.current = true;
    clearAllTimeouts();
    setPhase("cta");
    setTypedCount(TYPEWRITER_TEXT.length);
    setBorderProgress(1);
    setLogoSettled(true);
  }, [clearAllTimeouts]);

  useEffect(() => {
    const t = setTimeout(() => setShowSkip(true), SKIP_APPEAR_DELAY);
    return () => clearTimeout(t);
  }, []);

  /* ── Exit transition ───────────────────────────────────────────── */

  const handleExit = useCallback(() => {
    clearAllTimeouts();
    // Capture logo position before phase change
    if (logoContainerRef.current) {
      const rect = logoContainerRef.current.getBoundingClientRect();
      setLogoFlyFrom({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    }
    setPhase("exit");
    setExitStage("fly");
    // After logo finishes flying, start simultaneous color transitions
    addTimeout(() => {
      setExitStage("colors");
      setLogoMode("dark");
    }, LOGO_FLY_DUR * 1000);
    // onDismiss after fly + color transition
    addTimeout(() => onDismiss(), (LOGO_FLY_DUR + EXIT_DUR) * 1000);
  }, [clearAllTimeouts, addTimeout, onDismiss]);

  /* ── Phase 1: Loading counter (rAF + direct DOM) ──────────────── */

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) {
      handleSkip();
      return;
    }

    const counterEl = counterRef.current;
    const containerEl = counterContainerRef.current;
    if (!counterEl || !containerEl) return;

    const startTime = performance.now();
    let fontsReady = false;
    let completed = false;

    document.fonts?.ready?.then(() => {
      fontsReady = true;
    });

    function step(now: number) {
      if (completed || !counterEl || !containerEl) return;
      const elapsed = now - startTime;
      const timeProgress = Math.min(elapsed / LOAD_MIN_TIME, 1);
      const eased = 1 - Math.pow(1 - timeProgress, 3);

      let percent: number;
      if (fontsReady && elapsed >= LOAD_MIN_TIME) {
        percent = 100;
      } else {
        percent = Math.min(Math.floor(eased * 97), 97);
      }

      counterEl.textContent = String(percent);
      const blur = 8 * (1 - percent / 100);
      containerEl.style.filter = `blur(${blur}px)`;

      if (percent >= 100 && !completed) {
        completed = true;
        addTimeout(() => setPhase("logo"), COUNTER_HOLD);
      } else {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Phase transitions ────────────────────────────────────────────── */

  useEffect(() => {
    if (skipTriggeredRef.current) return;

    if (phase === "logo") {
      addTimeout(() => setLogoSettled(true), LOGO_REVEAL_DUR + LOGO_HOLD);
      addTimeout(
        () => setPhase("greeting"),
        LOGO_REVEAL_DUR + LOGO_HOLD + LOGO_SETTLE_DUR
      );
    } else if (phase === "greeting") {
      addTimeout(() => setPhase("typewriter"), GREETING_DUR);
    } else if (phase === "typewriter") {
      // Find the pause point after "quiet down. "
      const pauseAfter = TYPEWRITER_TEXT.indexOf(". ") + 2;
      let cumulativeDelay = 0;
      Array.from(TYPEWRITER_TEXT).forEach((_, i) => {
        if (i === pauseAfter) cumulativeDelay += SENTENCE_PAUSE;
        addTimeout(() => setTypedCount(i + 1), cumulativeDelay);
        cumulativeDelay += CHAR_DELAY;
      });
      addTimeout(() => setPhase("cta"), cumulativeDelay + POST_TYPE_DELAY);
    } else if (phase === "cta" && borderProgress < 1) {
      const start = performance.now();
      function animate(now: number) {
        const t = Math.min((now - start) / BORDER_DRAW_DUR, 1);
        setBorderProgress(t);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Derived state ────────────────────────────────────────────────── */

  const isExiting = phase === "exit";
  const colorsActive = exitStage === "colors";

  /** Captured logo rect at moment of exit trigger */
  const [logoFlyFrom, setLogoFlyFrom] = useState<{ x: number; y: number } | null>(null);

  /* Nav logo target: px-6 (24px) + 48/2 = 48px center-x, h-14 (56px) / 2 = 28px center-y */
  const NAV_TARGET = { x: 48, y: 28 };

  /* ── Render ───────────────────────────────────────────────────────── */

  return (
    <motion.div
      key="splash"
      className="fixed inset-0 z-50 overflow-hidden"
      initial={{ backgroundColor: "#F5F4F0" }}
      animate={{
        backgroundColor: colorsActive ? "#0C110A" : "#F5F4F0",
      }}
      transition={{ duration: colorsActive ? EXIT_DUR : 0, ease: "easeInOut" }}
    >
      {/* ── Loading Counter ──────────────────────────────────────── */}
      <motion.div
        ref={counterContainerRef}
        className="absolute inset-0 flex items-center justify-center select-none"
        animate={{
          opacity: phase === "loading" ? 1 : 0,
          scale: phase === "loading" ? 1 : 1.05,
        }}
        transition={{ duration: 0.4 }}
        style={{ pointerEvents: phase === "loading" ? "auto" : "none" }}
      >
        <div className="flex items-baseline gap-1">
          <span
            ref={counterRef}
            className="font-mono text-base-dark text-[clamp(5rem,25vw,18rem)] leading-none tracking-tighter"
          >
            0
          </span>
          <span className="font-mono text-base-dark text-[clamp(1.5rem,6vw,4rem)] leading-none opacity-20">
            %
          </span>
        </div>
      </motion.div>

      {/* ── Content (Logo + Paragraph + CTA) ─────────────────────── */}
      {atLeast("logo") && (
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center px-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: isExiting ? 0 : 1 }}
        transition={{ duration: isExiting ? 0.3 : 0.3, delay: isExiting ? 0 : 0.15 }}
        style={{ pointerEvents: isExiting ? "none" : "auto" }}
      >
        {/* Logo (in-flow during normal phases) */}
        <motion.div
          ref={logoContainerRef}
          className="mb-10"
          initial={{ width: initialLogoSize, height: initialLogoSize }}
          animate={{
            width: logoSettled ? 72 : initialLogoSize,
            height: logoSettled ? 72 : initialLogoSize,
          }}
          transition={{
            duration: logoSettled ? 0.8 : 0,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ opacity: isExiting ? 0 : 1 }}
        >
          <HzyMark
            mode="light"
            animate={atLeast("logo")}
            duration={LOGO_REVEAL_DUR}
          />
        </motion.div>

        {/* ── Flowing paragraph ──────────────────────────────────── */}
        <div className="max-w-lg text-center">
          <p className="text-base-dark text-[clamp(1.05rem,2.5vw,1.4rem)] leading-relaxed">
            {/* Beat 1: "hey, i'm Divine — " */}
            {atLeast("greeting") && (
              <motion.span
                key="greeting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="font-bold"
              >
                hey, i&apos;m Divine —{" "}
              </motion.span>
            )}

            {/* Beat 2: Typewriter with formatted segments */}
            {atLeast("typewriter") && renderTypedSegments(typedCount, typedCount >= TYPEWRITER_TEXT.length)}

            {/* Blinking cursor (after typed chars, before completion) */}
            {atLeast("typewriter") &&
              typedCount < TYPEWRITER_TEXT.length && (
                <span className="inline-block w-0.5 h-[1.1em] bg-base-dark align-text-bottom ml-px animate-blink" />
              )}
          </p>

          {/* CTA: "let's go →" with draw-in border */}
          <AnimatePresence>
            {phase === "cta" && (
              <motion.button
                key="cta"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                onClick={handleExit}
                className="relative mt-10 px-8 py-3 font-sans text-base-dark text-sm tracking-wide cursor-pointer
                           hover:bg-accent hover:text-base-light transition-colors duration-300"
              >
                {/* Top */}
                <span
                  className="absolute top-0 left-0 h-px bg-accent origin-left"
                  style={{
                    width: "100%",
                    transform: `scaleX(${clamp01(borderProgress * 4)})`,
                  }}
                />
                {/* Right */}
                <span
                  className="absolute top-0 right-0 w-px bg-accent origin-top"
                  style={{
                    height: "100%",
                    transform: `scaleY(${clamp01((borderProgress - 0.25) * 4)})`,
                  }}
                />
                {/* Bottom */}
                <span
                  className="absolute bottom-0 right-0 h-px bg-accent origin-right"
                  style={{
                    width: "100%",
                    transform: `scaleX(${clamp01((borderProgress - 0.5) * 4)})`,
                  }}
                />
                {/* Left */}
                <span
                  className="absolute bottom-0 left-0 w-px bg-accent origin-bottom"
                  style={{
                    height: "100%",
                    transform: `scaleY(${clamp01((borderProgress - 0.75) * 4)})`,
                  }}
                />
                let&apos;s go →
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      )}

      {/* ── Flying logo (only during exit, uses captured position) ── */}
      {isExiting && logoFlyFrom && (
        <motion.div
          layoutId="hzy-mark"
          className="fixed z-10"
          initial={{
            width: 72,
            height: 72,
            left: logoFlyFrom.x - 36,
            top: logoFlyFrom.y - 36,
          }}
          animate={{
            width: 48,
            height: 48,
            left: NAV_TARGET.x - 24,
            top: NAV_TARGET.y - 24,
          }}
          transition={{
            duration: LOGO_FLY_DUR,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <HzyMark
            mode={logoMode}
            animate={false}
            duration={LOGO_REVEAL_DUR}
          />
        </motion.div>
      )}

      {/* ── Skip ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSkip && phase !== "cta" && phase !== "exit" && (
          <motion.button
            key="skip"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleSkip}
            className="fixed bottom-8 right-8 font-mono text-xs text-base-dark
                       cursor-pointer hover:opacity-60 transition-opacity z-50"
          >
            skip
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Render typed segments with italic/bold formatting and underline on the bold segment. */
function renderTypedSegments(typedCount: number, isComplete: boolean) {
  const nodes: React.ReactNode[] = [];
  let offset = 0;

  for (let i = 0; i < TYPEWRITER_SEGMENTS.length; i++) {
    const seg = TYPEWRITER_SEGMENTS[i];
    const segStart = offset;
    const segEnd = offset + seg.text.length;
    offset = segEnd;

    if (typedCount <= segStart) break; // haven't reached this segment yet

    const visible = seg.text.slice(0, typedCount - segStart);

    if (seg.bold) {
      nodes.push(
        <span key={i} className="relative inline font-bold">
          {visible}
          {isComplete && (
            <span
              className="absolute bottom-0 left-0 h-0.5 w-full bg-accent origin-right"
              style={{
                animation: `underline-draw ${UNDERLINE_DUR}ms ${UNDERLINE_DELAY}ms cubic-bezier(0.22,1,0.36,1) forwards`,
              }}
            />
          )}
        </span>
      );
    } else if (seg.italic) {
      nodes.push(<em key={i}>{visible}</em>);
    } else {
      nodes.push(<span key={i}>{visible}</span>);
    }
  }

  return <>{nodes}</>;
}

/** Clamp a value between 0 and 1. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

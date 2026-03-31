"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Hero } from "./Hero";
import { About } from "./About";
import { Seedling } from "./Seedling";
import { TechStack } from "./TechStack";
import { ProjectCards } from "./ProjectCards";
import { CTA } from "./CTA";
import { TourNudge } from "./TourNudge";
import type { FeaturedProject } from "@/lib/data/projects";

/* ── Transition variants ──────────────────────────────────────────── */

type TransitionType = "fadeUp" | "slideUp" | "crossfade" | "wipeUp" | "slideLeft" | "fade";

const TRANSITION_MAP: TransitionType[] = [
  "fadeUp",    // Splash → Hero
  "slideUp",   // Hero → About
  "crossfade", // About → Seedling
  "wipeUp",    // Seedling → TechStack
  "slideLeft", // TechStack → Projects
  "fade",      // Projects → CTA
  "fade",      // CTA → TourNudge
];

function getVariants(type: TransitionType) {
  switch (type) {
    case "fadeUp":
      return {
        initial: { opacity: 0, y: 60 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -60 },
      };
    case "slideUp":
      return {
        initial: { y: "100%" },
        animate: { y: 0 },
        exit: { y: "-100%" },
      };
    case "crossfade":
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };
    case "wipeUp":
      return {
        initial: { clipPath: "inset(100% 0 0 0)" },
        animate: { clipPath: "inset(0% 0 0 0)" },
        exit: { clipPath: "inset(0 0 100% 0)" },
      };
    case "slideLeft":
      return {
        initial: { x: "100%", opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "-100%", opacity: 0 },
      };
    case "fade":
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      };
  }
}

/* ── Section components ───────────────────────────────────────────── */

const SECTION_KEYS = ["hero", "about", "seedling", "techstack", "projects", "cta", "tour"] as const;

/* ── SequenceController ───────────────────────────────────────────── */

interface SequenceControllerProps {
  projects: FeaturedProject[];
  onComplete: () => void;
  onTourStart: () => void;
}

export function SequenceController({ projects, onComplete, onTourStart }: SequenceControllerProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const lastScrollTime = useRef(0);
  const touchStartY = useRef(0);

  const advance = useCallback(
    (direction: 1 | -1) => {
      const now = Date.now();
      if (transitioning || now - lastScrollTime.current < 300) return;
      lastScrollTime.current = now;

      setActiveSection((prev) => {
        const next = prev + direction;
        if (next < 0) return 0;
        if (next > SECTION_KEYS.length - 1) return prev;
        setTransitioning(true);
        return next;
      });
    },
    [transitioning]
  );

  // Lock scroll and intercept wheel/touch
  useEffect(() => {
    const html = document.documentElement;
    html.style.overflow = "hidden";

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (Math.abs(e.deltaY) < 10) return;
      advance(e.deltaY > 0 ? 1 : -1);
    }

    function handleTouchStart(e: TouchEvent) {
      touchStartY.current = e.touches[0].clientY;
    }

    function handleTouchEnd(e: TouchEvent) {
      const dy = touchStartY.current - e.changedTouches[0].clientY;
      if (Math.abs(dy) < 30) return;
      advance(dy > 0 ? 1 : -1);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        advance(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        advance(-1);
      }
    }

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      html.style.overflow = "";
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [advance]);

  const transitionType = TRANSITION_MAP[activeSection] || "fade";
  const variants = getVariants(transitionType);
  const sectionKey = SECTION_KEYS[activeSection];

  function handleTourDecline() {
    onComplete();
  }

  function renderSection() {
    switch (sectionKey) {
      case "hero":
        return <Hero mode="sequence" />;
      case "about":
        return <About mode="sequence" />;
      case "seedling":
        return <Seedling mode="sequence" />;
      case "techstack":
        return <TechStack mode="sequence" />;
      case "projects":
        return <ProjectCards projects={projects} mode="sequence" />;
      case "cta":
        return <CTA mode="sequence" />;
      case "tour":
        return (
          <TourNudge
            mode="sequence"
            onStart={onTourStart}
            onDecline={handleTourDecline}
          />
        );
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-(--lobby-surface)">
      {/* Progress indicator */}
      <div className="fixed top-1/2 right-4 -translate-y-1/2 z-50 flex flex-col gap-2">
        {SECTION_KEYS.map((key, i) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (!transitioning) {
                setTransitioning(true);
                setActiveSection(i);
              }
            }}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              i === activeSection
                ? "bg-(--lobby-accent) scale-150"
                : "bg-white/20 hover:bg-white/40"
            }`}
            aria-label={`Go to ${key} section`}
          />
        ))}
      </div>

      <AnimatePresence
        mode="wait"
        onExitComplete={() => setTransitioning(false)}
      >
        <motion.div
          key={sectionKey}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          {renderSection()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

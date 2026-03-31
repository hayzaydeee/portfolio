"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSetSplashActive } from "@/lib/splash-context";
import { Splash } from "./Splash";
import { SequenceController } from "./SequenceController";
import { Hero } from "./Hero";
import { About } from "./About";
import { Seedling } from "./Seedling";
import { ProjectCards } from "./ProjectCards";
import { TechStack } from "./TechStack";
import { CTA } from "./CTA";
import { TourNudge } from "./TourNudge";
import { GuidedTour } from "./GuidedTour";
import { CurrentlyIndicator } from "./CurrentlyIndicator";
import type { Currently } from "@/lib/data/currently";
import type { FeaturedProject } from "@/lib/data/projects";

/* ── Returning visitor flag ───────────────────────────────────────── */
// Module-level: reset on page refresh (new JS context), persists on navigate-back
let lobbyVisited = false;

interface LobbyPageProps {
  currently: Currently | null;
  projects: FeaturedProject[];
}

type Phase = "splash" | "sequence" | "resting";

export function LobbyPage({ currently, projects }: LobbyPageProps) {
  const [phase, setPhase] = useState<Phase>(() =>
    lobbyVisited ? "resting" : "splash"
  );
  const [tourActive, setTourActive] = useState(false);
  const setSplashActive = useSetSplashActive();

  // Sync splash state to context so Nav can react
  useEffect(() => {
    setSplashActive(phase === "splash");
  }, [phase, setSplashActive]);

  function handleSplashDismiss() {
    setPhase("sequence");
  }

  function handleSequenceComplete() {
    lobbyVisited = true;
    setPhase("resting");
  }

  function handleTourStart() {
    lobbyVisited = true;
    setPhase("resting");
    setTourActive(true);
  }

  return (
    <>
      {/* Splash */}
      <AnimatePresence>
        {phase === "splash" && <Splash onDismiss={handleSplashDismiss} />}
      </AnimatePresence>

      {/* Sequence mode */}
      <AnimatePresence>
        {phase === "sequence" && (
          <motion.div
            key="sequence"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SequenceController
              projects={projects}
              onComplete={handleSequenceComplete}
              onTourStart={handleTourStart}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resting state */}
      <AnimatePresence>
        {phase === "resting" && (
          <motion.div
            key="resting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Hero mode="resting" />
            <About mode="resting" />
            <Seedling mode="resting" />
            <TechStack mode="resting" />
            <ProjectCards projects={projects} mode="resting" />
            <CTA mode="resting" />
            <TourNudge
              mode="resting"
              onStart={() => setTourActive(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <CurrentlyIndicator data={currently} />

      <AnimatePresence>
        {tourActive && <GuidedTour onClose={() => setTourActive(false)} />}
      </AnimatePresence>
    </>
  );
}

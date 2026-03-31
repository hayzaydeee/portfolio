"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Splash } from "./Splash";
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

interface LobbyPageProps {
  currently: Currently | null;
  projects: FeaturedProject[];
}

export function LobbyPage({ currently, projects }: LobbyPageProps) {
  const [showSplash, setShowSplash] = useState(true);
  const [tourActive, setTourActive] = useState(false);

  function handleDismiss() {
    setShowSplash(false);
  }

  return (
    <>
      <AnimatePresence>
        {showSplash && <Splash onDismiss={handleDismiss} />}
      </AnimatePresence>

      <motion.div
        initial={false}
        animate={{ opacity: showSplash ? 0 : 1, y: showSplash ? 12 : 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ pointerEvents: showSplash ? "none" : undefined }}
      >
        <Hero />
        <About />
        <Seedling />
        <ProjectCards projects={projects} />
        <TechStack />
        <CTA />
        <TourNudge onStart={() => setTourActive(true)} />
      </motion.div>

      <CurrentlyIndicator data={currently} />

      <AnimatePresence>
        {tourActive && <GuidedTour onClose={() => setTourActive(false)} />}
      </AnimatePresence>
    </>
  );
}

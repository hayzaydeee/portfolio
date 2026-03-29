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
import { CurrentlyIndicator } from "./CurrentlyIndicator";
import type { Currently } from "@/lib/data/currently";
import type { FeaturedProject } from "@/lib/data/projects";

interface LobbyPageProps {
  currently: Currently | null;
  projects: FeaturedProject[];
}

export function LobbyPage({ currently, projects }: LobbyPageProps) {
  const [showSplash, setShowSplash] = useState<boolean | null>(null);

  useEffect(() => {
    const seen = sessionStorage.getItem("hzy-splash-seen");
    setShowSplash(!seen);
  }, []);

  function handleDismiss() {
    sessionStorage.setItem("hzy-splash-seen", "1");
    setShowSplash(false);
  }

  // During SSR and hydration, render neither splash nor lobby until
  // sessionStorage check resolves (prevents flash)
  if (showSplash === null) {
    return <div className="min-h-screen bg-(--lobby-surface)" />;
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
        <TourNudge />
      </motion.div>

      <CurrentlyIndicator data={currently} />
    </>
  );
}

"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { MusicProject, AnalysisEssay } from "@/app/actions/studio";
import { ModeToggle } from "@/components/studio/ModeToggle";
import { TracksMode } from "@/components/studio/TracksMode";
import { AnalysisMode } from "@/components/studio/AnalysisMode";

type Mode = "tracks" | "analysis";

type Props = {
  projects: MusicProject[];
  wipProjects: MusicProject[];
  essays: AnalysisEssay[];
  featured: MusicProject | null;
};

export function StudioPage({ projects, wipProjects, essays, featured }: Props) {
  const [mode, setMode] = useState<Mode>("tracks");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Studio header: the glass dock handles navigation, this bar only switches modes */}
      <header className="sticky top-16 md:top-0 z-30 flex items-center justify-center px-6 py-4 bg-(--studio-base) border-b border-(--studio-border)">
        <h1 className="sr-only">studio</h1>
        <ModeToggle mode={mode} onChange={setMode} />
      </header>

      {/* Content world */}
      <div className="flex-1 relative overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "tracks" ? (
            <motion.div
              key="tracks"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <TracksMode projects={projects} wipProjects={wipProjects} featured={featured} />
            </motion.div>
          ) : (
            <motion.div
              key="analysis"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <AnalysisMode essays={essays} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

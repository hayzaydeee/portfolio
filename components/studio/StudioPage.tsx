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
      {/* Studio header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-6 py-4"
        style={{
          background: "var(--studio-base)",
          borderBottom: "1px solid var(--studio-border)",
        }}
      >
        <a
          href="/"
          className="text-sm font-mono transition-colors duration-150"
          style={{ color: "var(--studio-text-muted)" }}
        >
          ← hzy
        </a>
        <ModeToggle mode={mode} onChange={setMode} />
        <div className="w-16" />
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

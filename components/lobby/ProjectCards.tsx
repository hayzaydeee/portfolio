"use client";

import { motion } from "motion/react";
import { SectionHeading } from "./SectionHeading";
import { ProjectWave } from "./ProjectWave";
import type { FeaturedProject } from "@/lib/data/projects";
import type { LobbyMode } from "./sectionProgress";

const PLACEHOLDER_PROJECTS: FeaturedProject[] = [
  {
    id: "1",
    slug: "vrrbose",
    title: "vrrbose",
    tagline: "your codebase has a memory now",
    stack: ["Node.js", "TypeScript", "Next.js", "SQLite", "Redis", "MCP", "Zod"],
    repo_url: "https://github.com",
    live_url: null,
    thumbnail_url: null,
    personal_note:
      "I built vrrbose because I kept losing the thread of my own work, and because I needed a reference for all my architectural decisions per project. every AI tool I used started from scratch \u2014 no context, no history, no awareness of what I\u2019d already decided. vrrbose fixes that. it runs quietly in the background, watching every commit, edit, and terminal command, then feeds that accumulated context to Claude Code, Cursor, and Copilot as they work. it also writes your session summaries, brag sheets, and other custom documentation, helping you have granular, persistent memory of what you\u2019ve worked on, and how you\u2019ve worked on it.",
    order_index: 1,
  },
  {
    id: "2",
    slug: "bito-works",
    title: "bito.works",
    tagline: "the habit app that builds the plan with you",
    stack: ["React", "Node.js", "JavaScript", "MongoDB", "Express.js", "WebSockets", "Recharts", "OpenAI API"],
    repo_url: null,
    live_url: "https://bito.works",
    thumbnail_url: null,
    personal_note:
      "I built bito because every habit tracker I tried did the same thing \u2014 logged what I did and judged me for what I didn\u2019t. bito v2 is different. Compass reads your existing habits, your streaks, your actual patterns, and builds a plan around how you already live rather than how you imagine you do.",
    order_index: 2,
  },
  {
    id: "3",
    slug: "gaff3r",
    title: "gaff3r",
    tagline: "football predictions, backed by real maths",
    stack: ["React", "Node.js", "JavaScript", "MongoDB", "React Flow", "React Query", "OpenRouter"],
    repo_url: null,
    live_url: null,
    thumbnail_url: null,
    personal_note:
      "I built gaff3r because I was tired of asking AI tools about upcoming fixtures and getting confident-sounding nonsense with no data behind it. I wanted something that actually did the maths. ask the gaffer about any Premier League fixture and it runs Dixon-Coles maximum-likelihood estimation across the full season, overlays an xG adjustment weighted toward recent form, draws 15,000 Monte Carlo simulations from the fitted model, and passes the output to Claude for a tactically-aware breakdown. you get win probabilities, a specific predicted scoreline, and the key factors driving the call \u2014 not vibes, not hedging. statistical rigour with a personality. v1 is live. the longer vision is a football intelligence platform with a data moat no chatbot can replicate.",
    order_index: 3,
  },
];

interface ProjectCardsProps {
  projects: FeaturedProject[];
  mode?: LobbyMode;
}

export function ProjectCards({ projects, mode = "resting" }: ProjectCardsProps) {
  const isSequence = mode === "sequence";
  const displayProjects = projects.length > 0 ? projects : PLACEHOLDER_PROJECTS;

  return (
    <section className={`px-6 ${isSequence ? "flex min-h-screen items-center justify-center" : "py-20"}`}>
      <motion.div
        className="mx-auto w-full max-w-6xl"
        initial={{ opacity: 0, x: isSequence ? 40 : 0 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <SectionHeading>PROJECTS</SectionHeading>
        <ProjectWave projects={displayProjects} />
      </motion.div>
    </section>
  );
}

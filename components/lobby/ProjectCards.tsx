"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence } from "motion/react";
import { ExternalLink, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";
import type { FeaturedProject } from "@/lib/data/projects";

interface ProjectCardsProps {
  projects: FeaturedProject[];
}

interface CardProps {
  project: FeaturedProject;
  isActive: boolean;
  isPassive: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function ProjectCard({ project, isActive, isPassive, onHover, onLeave }: CardProps) {
  return (
    <motion.div
      layout
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      animate={{
        scale: isPassive ? 0.95 : 1,
        opacity: isPassive ? 0.7 : 1,
      }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className={cn(
        "relative rounded-xl border border-white/10 bg-(--lobby-card) overflow-hidden shrink-0 cursor-pointer",
        "transition-shadow hover:shadow-md",
        isActive ? "w-85 md:w-105" : "w-55 md:w-65"
      )}
      style={{ minHeight: 240 }}
    >
      {/* Thumbnail / placeholder */}
      <div className="h-32 bg-(--lobby-surface-deep) flex items-center justify-center">
        {project.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.thumbnail_url}
            alt={project.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs font-mono text-text-muted">{project.slug}</span>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-sans font-medium text-(--lobby-text)">
            {project.title}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            {project.live_url && (
              <a
                href={project.live_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${project.title} live site`}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={13} className="text-text-muted hover:text-accent" />
              </a>
            )}
            {project.repo_url && (
              <a
                href={project.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${project.title} repository`}
                onClick={(e) => e.stopPropagation()}
              >
                <GitBranch size={13} className="text-text-muted hover:text-accent" />
              </a>
            )}
          </div>
        </div>

        {project.tagline && (
          <p className="text-xs text-text-muted mt-1 line-clamp-2">
            {project.tagline}
          </p>
        )}

        {/* Expanded content */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {project.personal_note && (
                <p className="mt-3 text-xs text-(--lobby-text) leading-relaxed border-t border-white/5 pt-3">
                  {project.personal_note}
                </p>
              )}
              {project.stack.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {project.stack.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-(--lobby-surface-deep) text-text-muted"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const PLACEHOLDER_PROJECTS: FeaturedProject[] = [
  {
    id: "1",
    slug: "vrrbose",
    title: "vrrbose",
    tagline: "your codebase has a memory now",
    stack: ["Node.js", "TypeScript", "MCP"],
    repo_url: "https://github.com",
    live_url: null,
    thumbnail_url: null,
    personal_note:
      "I built vrrbose because I kept losing the thread of my own work. every AI tool I used started from scratch \u2014 no context, no history, no awareness of what I\u2019d already decided. vrrbose fixes that. it runs quietly in the background, watching every commit, edit, and terminal command, then feeds that accumulated context to Claude Code, Cursor, and Copilot as they work.",
    order_index: 1,
  },
  {
    id: "2",
    slug: "bito-works",
    title: "bito.works",
    tagline: "the habit app that builds the plan with you",
    stack: ["Next.js", "Supabase", "Anthropic"],
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
    stack: ["Cloudflare Workers", "Llama 3.3", "Python"],
    repo_url: null,
    live_url: null,
    thumbnail_url: null,
    personal_note:
      "most football prediction tools are either betting platforms in disguise or AI chatbots hallucinating statistics with false confidence. gaff3r is neither. ask the gaffer about any Premier League fixture and it runs Dixon-Coles maximum-likelihood estimation across the full season, overlays an xG adjustment weighted toward recent form, draws 15,000 Monte Carlo simulations from the fitted model, and passes the output to Claude for a tactically-aware breakdown.",
    order_index: 3,
  },
];

interface ProjectCardsProps {
  projects: FeaturedProject[];
  mode?: "sequence" | "resting";
}

export function ProjectCards({ projects, mode = "resting" }: ProjectCardsProps) {
  const isSequence = mode === "sequence";
  const [activeId, setActiveId] = useState<string | null>(null);
  const displayProjects = projects.length > 0 ? projects : PLACEHOLDER_PROJECTS;
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-60%"]);

  if (isSequence) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-(--lobby-surface-deep) px-6">
        <div className="max-w-[100vw] w-full px-6">
          <SectionHeading>PROJECTS</SectionHeading>
          <div className="flex items-stretch gap-4 justify-center flex-wrap md:flex-nowrap">
            {displayProjects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15, duration: 0.4, ease: "easeOut" }}
              >
                <ProjectCard
                  project={project}
                  isActive={activeId === project.id}
                  isPassive={activeId !== null && activeId !== project.id}
                  onHover={() => setActiveId(project.id)}
                  onLeave={() => setActiveId(null)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <div ref={containerRef} className="h-[250vh] relative">
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden bg-(--lobby-surface-deep)">
        <SectionHeading>PROJECTS</SectionHeading>
        <div className="max-w-[100vw] w-full px-6">
          <motion.div
            className="flex items-stretch gap-4"
            style={{ x }}
          >
            {displayProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isActive={activeId === project.id}
                isPassive={activeId !== null && activeId !== project.id}
                onHover={() => setActiveId(project.id)}
                onLeave={() => setActiveId(null)}
              />
            ))}

            <div className="flex items-center pl-2 shrink-0">
              <Link
                href="/work"
                className="text-sm font-sans text-accent-muted hover:text-accent transition-colors whitespace-nowrap"
              >
                see more in the workshop →
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

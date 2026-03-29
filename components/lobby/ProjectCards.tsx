"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { ExternalLink, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
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
          <span className="text-xs font-mono text-(--color-text-muted)">{project.slug}</span>
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
                <ExternalLink size={13} className="text-(--color-text-muted) hover:text-(--color-accent)" />
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
                <GitBranch size={13} className="text-(--color-text-muted) hover:text-(--color-accent)" />
              </a>
            )}
          </div>
        </div>

        {project.tagline && (
          <p className="text-xs text-(--color-text-muted) mt-1 line-clamp-2">
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
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-(--lobby-surface-deep) text-(--color-text-muted)"
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
    tagline: "developer tooling for verbose-first logging in Node.js",
    stack: ["Node.js", "TypeScript"],
    repo_url: "https://github.com",
    live_url: null,
    thumbnail_url: null,
    personal_note:
      "Built out of frustration with console.log. Wanted a logger that felt like working in a notebook.",
    order_index: 1,
  },
  {
    id: "2",
    slug: "bito-works",
    title: "bito.works",
    tagline: "a quiet inbox for ideas — voice, text, or typed",
    stack: ["Next.js", "Supabase", "Anthropic"],
    repo_url: null,
    live_url: "https://bito.works",
    thumbnail_url: null,
    personal_note:
      "The project that became this site&apos;s Notebook section. Built so thoughts don&apos;t get lost.",
    order_index: 2,
  },
];

export function ProjectCards({ projects }: ProjectCardsProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const displayProjects = projects.length > 0 ? projects : PLACEHOLDER_PROJECTS;

  return (
    <section className="bg-(--lobby-surface-deep) py-20 px-6 overflow-hidden">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-stretch gap-4 overflow-x-auto pb-4 scrollbar-none">
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

          {/* Trailing "see more" */}
          <div className="flex items-end pb-4 pl-2 shrink-0">
            <Link
              href="/work"
              className="text-sm font-sans text-(--color-accent-muted) hover:text-(--color-accent) transition-colors whitespace-nowrap"
           >
              see more in the workshop →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

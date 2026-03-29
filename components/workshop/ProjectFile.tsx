import DOMPurify from "isomorphic-dompurify";
import Link from "next/link";
import { ExternalLink, GitBranch } from "lucide-react";

import type { Project } from "@/app/actions/projects";
import { StatusBadge } from "@/components/admin/StatusBadge";

// ─── AskFunction stub (wired in Phase 6) ─────────────────────────────────────

function AskFunction() {
  return (
    <div
      className="mt-12 border border-dashed rounded-lg p-4 font-mono text-xs opacity-40 select-none"
      style={{ borderColor: "var(--workshop-syntax-dim)", color: "var(--workshop-text-muted)" }}
    >
      // ask about this project — coming soon
    </div>
  );
}

// ─── Sanitized HTML block ─────────────────────────────────────────────────────

function HtmlBlock({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return (
    <div
      className="prose prose-sm max-w-none
        prose-headings:font-mono prose-headings:font-semibold
        prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-a:underline"
      style={
        {
          color: "var(--workshop-text)",
          "--tw-prose-body": "var(--workshop-text)",
          "--tw-prose-headings": "var(--workshop-text)",
          "--tw-prose-links": "var(--workshop-syntax)",
          "--tw-prose-code": "var(--workshop-syntax)",
          "--tw-prose-pre-bg": "var(--workshop-panel)",
          "--tw-prose-bullets": "var(--workshop-syntax-dim)",
          "--tw-prose-counters": "var(--workshop-syntax-dim)",
          "--tw-prose-hr": "var(--workshop-tree-border)",
          "--tw-prose-quotes": "var(--workshop-text-muted)",
        } as React.CSSProperties
      }
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type ProjectFileProps = {
  project: Project;
};

export function ProjectFile({ project }: ProjectFileProps) {
  return (
    <div
      className="p-8 max-w-3xl mx-auto overflow-y-auto h-full"
      style={{ color: "var(--workshop-text)" }}
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1
            className="text-3xl font-mono font-semibold tracking-tight"
            style={{ color: "var(--workshop-text)" }}
          >
            {project.title}
          </h1>
          <StatusBadge status={project.status} />
        </div>

        {project.tagline && (
          <p className="text-sm mb-4" style={{ color: "var(--workshop-text-muted)" }}>
            {project.tagline}
          </p>
        )}

        {/* External links */}
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--workshop-syntax)" }}>
          {project.live_url && (
            <Link
              href={project.live_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:underline"
            >
              <ExternalLink size={12} />
              live site
            </Link>
          )}
          {project.repo_url && (
            <Link
              href={project.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:underline"
            >
              <GitBranch size={12} />
              source
            </Link>
          )}
        </div>
      </div>

      {/* Stack */}
      {project.stack && project.stack.length > 0 && (
        <div className="mb-8">
          <div
            className="text-xs mb-2 font-mono"
            style={{ color: "var(--workshop-syntax-dim)" }}
          >
            // stack
          </div>
          <div className="flex flex-wrap gap-2">
            {project.stack.map((tech) => (
              <code
                key={tech}
                className="px-2 py-0.5 rounded text-xs font-mono"
                style={{
                  background: "color-mix(in srgb, var(--workshop-syntax) 15%, transparent)",
                  color: "var(--workshop-syntax)",
                  border: "1px solid color-mix(in srgb, var(--workshop-syntax) 30%, transparent)",
                }}
              >
                {tech}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* The problem */}
      {project.problem_notes && (
        <section className="mb-8">
          <div
            className="text-xs mb-3 font-mono"
            style={{ color: "var(--workshop-syntax-dim)" }}
          >
            // the problem
          </div>
          <HtmlBlock html={project.problem_notes} />
        </section>
      )}

      {/* The build */}
      {project.build_notes && (
        <section className="mb-8">
          <div
            className="text-xs mb-3 font-mono"
            style={{ color: "var(--workshop-syntax-dim)" }}
          >
            // the build
          </div>
          <HtmlBlock html={project.build_notes} />
        </section>
      )}

      {/* Personal note */}
      {project.personal_note && (
        <section className="mb-8">
          <p
            className="text-sm italic leading-relaxed"
            style={{ color: "var(--workshop-text-muted)" }}
          >
            {project.personal_note}
          </p>
        </section>
      )}

      <AskFunction />
    </div>
  );
}

import DOMPurify from "isomorphic-dompurify";
import { ExternalLink, GitBranch } from "lucide-react";

import type { Project } from "@/app/actions/projects";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AskTerminal } from "@/components/workshop/AskTerminal";
import { ProjectIdentity } from "@/components/workshop/ProjectIdentity";
import { Cta } from "@/components/fx/ui/Cta";

// ─── Sanitized HTML block ─────────────────────────────────────────────────────

function HtmlBlock({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return (
    <div
      className="workshop-prose prose prose-sm max-w-none text-(--workshop-text)
        prose-headings:font-mono prose-headings:font-semibold
        prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-a:underline"
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
    <div className="h-full overflow-y-auto text-(--workshop-text)">
      {/* Identity field: the project's chosen visual, fading into the editor */}
      <div className="relative h-56 w-full md:h-72" data-project-identity={project.visual_variant ?? "default"}>
        <ProjectIdentity variant={project.visual_variant} accent={project.visual_accent} title={project.title} className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-(--workshop-panel)" />
      </div>

      <div className="relative mx-auto -mt-12 max-w-3xl px-8 pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h1
              className="text-3xl font-mono font-semibold tracking-tight text-(--workshop-text)"
            >
              {project.title}
            </h1>
            <StatusBadge status={project.status} />
          </div>

          {project.tagline && (
            <p className="text-sm mb-4 text-(--workshop-text-muted)">
              {project.tagline}
            </p>
          )}

          {/* External links, as keycaps */}
          {(project.live_url || project.repo_url) && (
            <div className="flex flex-wrap items-center gap-3">
              {project.live_url && (
                <Cta
                  variant="keycap"
                  emphasis="primary"
                  href={project.live_url}
                  target="_blank"
                  label="live site"
                  icon={<ExternalLink size={12} aria-hidden="true" />}
                  size="sm"
                  room="workshop"
                />
              )}
              {project.repo_url && (
                <Cta
                  variant="keycap"
                  href={project.repo_url}
                  target="_blank"
                  label="source"
                  icon={<GitBranch size={12} aria-hidden="true" />}
                  size="sm"
                  room="workshop"
                />
              )}
            </div>
          )}
        </div>

        {/* Stack */}
        {project.stack && project.stack.length > 0 && (
          <div className="mb-8">
            <div
              className="text-xs mb-2 font-mono text-(--workshop-syntax-dim)"
            >
              {"// stack"}
            </div>
            <div className="flex flex-wrap gap-2">
              {project.stack.map((tech) => (
                <code
                  key={tech}
                  className="rounded border border-(--workshop-syntax)/30 bg-(--workshop-syntax)/15 px-2 py-0.5 font-mono text-xs text-(--workshop-syntax)"
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
              className="text-xs mb-3 font-mono text-(--workshop-syntax-dim)"
            >
              {"// the problem"}
            </div>
            <HtmlBlock html={project.problem_notes} />
          </section>
        )}

        {/* The build */}
        {project.build_notes && (
          <section className="mb-8">
            <div
              className="text-xs mb-3 font-mono text-(--workshop-syntax-dim)"
            >
              {"// the build"}
            </div>
            <HtmlBlock html={project.build_notes} />
          </section>
        )}

        {/* Personal note */}
        {project.personal_note && (
          <section className="mb-8">
            <p
              className="text-sm italic leading-relaxed text-(--workshop-text-muted)"
            >
              {project.personal_note}
            </p>
          </section>
        )}

        <AskTerminal
          className="mt-12"
          defaultQuery={`what's the most interesting part of ${project.title}?`}
          variant="workshop"
        />
      </div>
    </div>
  );
}

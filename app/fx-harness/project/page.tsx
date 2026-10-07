import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { Project } from "@/app/actions/projects";
import { ProjectFile } from "@/components/workshop/ProjectFile";
import { PROJECT_VISUALS, ACCENT_TOKENS, type ProjectVisual, type AccentToken } from "@/lib/fx/projectVisuals";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * A project page from a fixture, for Playwright and screenshots without a database:
 * ?variant=warp-field&accent=notebook-fragments picks the identity field and its accent.
 */
export default async function ProjectHarness({ searchParams }: Props) {
  // Render per request: FX_HARNESS is read at runtime, never baked in at build
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.FX_HARNESS !== "1") notFound();

  const params = await searchParams;
  const variant = typeof params.variant === "string" && (PROJECT_VISUALS as readonly string[]).includes(params.variant) ? (params.variant as ProjectVisual) : null;
  const accent = typeof params.accent === "string" && (ACCENT_TOKENS as readonly string[]).includes(params.accent) ? (params.accent as AccentToken) : null;

  const project: Project = {
    id: "fixture",
    slug: "vrrbose",
    title: "vrrbose",
    tagline: "your codebase has a memory now",
    problem_notes: "<p>every AI tool started from scratch: no context, no history, no awareness of what had already been decided.</p>",
    build_notes: "<p>a daemon watches commits, edits and terminal commands, and feeds that context to coding agents over an MCP gateway.</p>",
    stack: ["Node.js", "TypeScript", "SQLite", "MCP"],
    personal_note: "the most technically ambitious thing built so far.",
    live_url: "https://example.com",
    repo_url: "https://github.com",
    thumbnail_url: null,
    is_featured: true,
    status: "published",
    order_index: 1,
    visual_variant: variant,
    visual_accent: accent,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  return (
    <main className="flex h-screen flex-col bg-(--workshop-base) text-(--workshop-text)">
      <div className="flex-1 overflow-hidden bg-(--workshop-panel)/75">
        <ProjectFile project={project} />
      </div>
    </main>
  );
}

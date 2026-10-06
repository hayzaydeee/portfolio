import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { createBuildClient } from "@/lib/supabase/server";
import { ProjectFile } from "@/components/workshop/ProjectFile";
import type { Project } from "@/app/actions/projects";

type Props = {
  params: Promise<{ project: string }>;
};

export async function generateStaticParams() {
  try {
    const supabase = createBuildClient();
    const { data } = await supabase
      .from("projects")
      .select("slug")
      .eq("status", "published");
    return (data ?? []).map((p: { slug: string }) => ({ project: p.slug }));
  } catch {
    // Supabase env vars not available at build time — no static pages pre-generated
    return [];
  }
}

/**
 * One read per request for metadata and page. Cookie-less anon client: calling cookies() in
 * this prerendered route would 500 any slug not built at deploy time (new or mistyped).
 * Unpublished, missing and unreachable all read as "no such project".
 */
const getProject = cache(async (slug: string): Promise<Project | null> => {
  try {
    const { data, error } = await createBuildClient()
      .from("projects")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();
    return error || !data ? null : (data as Project);
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { project: slug } = await params;
  const project = await getProject(slug);
  return {
    title: project ? `${project.title} — hayzaydee` : "Project — hayzaydee",
    description: project?.tagline ?? undefined,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { project: slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      {/* Project content */}
      <div className="flex-1 overflow-auto bg-(--workshop-panel)">
        <ProjectFile project={project} />
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

import { createPublicClient, createBuildClient } from "@/lib/supabase/server";
import { ProjectFile } from "@/components/workshop/ProjectFile";
import { HzyMark } from "@/components/nav/HzyMark";
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { project: slug } = await params;
  const supabase = await createPublicClient();
  const { data } = await supabase
    .from("projects")
    .select("title, tagline")
    .eq("slug", slug)
    .single();
  return {
    title: data ? `${data.title} — hayzaydee` : "Project — hayzaydee",
    description: data?.tagline ?? undefined,
  };
}

export default async function ProjectPage({ params }: Props) {
  const { project: slug } = await params;
  const supabase = await createPublicClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !data) notFound();

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* IDE-style header */}
      <header
        className="flex items-center gap-3 px-4 py-2 border-b shrink-0"
        style={{
          background: "var(--workshop-panel)",
          borderColor: "var(--workshop-tree-border)",
        }}
      >
        <Link href="/work" aria-label="back to workshop" className="flex items-center gap-2">
          <HzyMark mode="dark" size={20} />
          <span className="font-mono text-xs" style={{ color: "var(--workshop-text-muted)" }}>
            ~/workshop
          </span>
        </Link>
        <span className="font-mono text-xs" style={{ color: "var(--workshop-syntax-dim)" }}>
          /
        </span>
        <span className="font-mono text-xs" style={{ color: "var(--workshop-text)" }}>
          {slug}/
        </span>
      </header>

      {/* Project content */}
      <div className="flex-1 overflow-auto" style={{ background: "var(--workshop-panel)" }}>
        <ProjectFile project={data as Project} />
      </div>
    </div>
  );
}

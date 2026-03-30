"use client";

import { useState } from "react";
import Link from "next/link";
import { MusicProjectsTable } from "@/components/admin/studio/MusicProjectsTable";
import { AnalysisEssaysTable } from "@/components/admin/studio/AnalysisEssaysTable";
import type { MusicProject, AnalysisEssay } from "@/app/actions/studio";

type Tab = "tracks" | "analysis";

type StudioClientProps = {
  projects: MusicProject[];
  essays: AnalysisEssay[];
};

export function StudioClient({ projects, essays }: StudioClientProps) {
  const [tab, setTab] = useState<Tab>("tracks");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-sans text-(--lobby-text)">Studio</h1>
          <p className="text-sm text-text-muted mt-0.5">Music projects and analysis essays</p>
        </div>
        {tab === "tracks" ? (
          <Link
            href="/admin/studio/new"
            className="text-sm px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            New project
          </Link>
        ) : (
          <Link
            href="/admin/studio/essays/new"
            className="text-sm px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            New essay
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-black/10">
        <button
          onClick={() => setTab("tracks")}
          className={[
            "px-4 py-2 text-sm font-sans border-b-2 -mb-px transition-colors",
            tab === "tracks"
              ? "border-accent text-accent"
              : "border-transparent text-text-muted hover:text-(--lobby-text)",
          ].join(" ")}
        >
          Tracks
          <span className="ml-1.5 text-xs opacity-60">{projects.length}</span>
        </button>
        <button
          onClick={() => setTab("analysis")}
          className={[
            "px-4 py-2 text-sm font-sans border-b-2 -mb-px transition-colors",
            tab === "analysis"
              ? "border-accent text-accent"
              : "border-transparent text-text-muted hover:text-(--lobby-text)",
          ].join(" ")}
        >
          Analysis
          <span className="ml-1.5 text-xs opacity-60">{essays.length}</span>
        </button>
      </div>

      {tab === "tracks" && <MusicProjectsTable projects={projects} />}
      {tab === "analysis" && <AnalysisEssaysTable essays={essays} />}
    </div>
  );
}

"use client";

import type { MusicProject } from "@/app/actions/studio";

type Props = {
  projects: MusicProject[];
};

export function ArtistAbout({ projects }: Props) {
  const trackCount = projects.reduce((s, p) => s + (p.tracks?.length ?? 0), 0);
  const years = projects.map((p) => p.release_year).filter(Boolean) as number[];
  const since = years.length ? Math.min(...years) : null;

  return (
    <section className="max-w-2xl mx-auto px-6 py-12">
      <div className="space-y-4 mb-8">
        <p className="text-base leading-relaxed" style={{ color: "var(--studio-text)" }}>
          Genre-fluid, rooted in intentional sound. The work draws from neo-soul, electronic
          minimalism, and jazz harmony — constructed carefully, never rushed. Every track is a
          deliberate study in texture and silence.
        </p>
        <p className="text-base leading-relaxed" style={{ color: "var(--studio-text-muted)" }}>
          Started making music long before I started making software. The two disciplines bleed into
          each other constantly — the same instinct that makes me want clean code makes me want
          clean arrangements. This is where that instinct lives.
        </p>
      </div>

      {(projects.length > 0 || since) && (
        <p className="text-sm font-mono" style={{ color: "var(--studio-text-muted)" }}>
          {projects.length > 0 && (
            <>
              <span style={{ color: "var(--studio-text)" }}>{projects.length}</span>{" "}
              {projects.length === 1 ? "project" : "projects"}
              {" · "}
            </>
          )}
          {trackCount > 0 && (
            <>
              <span style={{ color: "var(--studio-text)" }}>{trackCount}</span>{" "}
              {trackCount === 1 ? "track" : "tracks"}
            </>
          )}
          {since && (
            <>
              {" · "}since <span style={{ color: "var(--studio-text)" }}>{since}</span>
            </>
          )}
        </p>
      )}
    </section>
  );
}

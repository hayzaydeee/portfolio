"use client";

import type { MusicProject } from "@/app/actions/studio";
import { FxStage } from "@/components/fx/FxStage";

type Props = {
  projects: MusicProject[];
};

export function ArtistAbout({ projects }: Props) {
  const trackCount = projects.reduce((s, p) => s + (p.tracks?.length ?? 0), 0);
  const years = projects.map((p) => p.release_year).filter(Boolean) as number[];
  const since = years.length ? Math.min(...years) : null;

  return (
    // isolate: the form's negative z stays inside the section, above the room's backdrop
    <section className="relative isolate mx-auto max-w-2xl px-6 py-12" data-artist-about="">
      {/* A lab option, dark until it's switched on: chrome swelling with the music behind the words */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto size-72 opacity-40 md:size-96" aria-hidden="true">
        <FxStage slot="studio.about" className="size-full" posterClassName="bg-transparent" />
      </div>
      <div className="mb-8 space-y-4">
        <p className="text-base leading-relaxed text-(--studio-text)">
          Genre-fluid, rooted in intentional sound. The work draws from neo-soul, electronic minimalism, and jazz harmony:
          constructed carefully, never rushed. Every track is a deliberate study in texture and silence.
        </p>
        <p className="text-base leading-relaxed text-(--studio-text-muted)">
          Started making music long before I started making software. The two disciplines bleed into each other constantly; the
          same instinct that makes me want clean code makes me want clean arrangements. This is where that instinct lives.
        </p>
      </div>

      {(projects.length > 0 || since) && (
        <p className="font-mono text-sm text-(--studio-text-muted)">
          {projects.length > 0 && (
            <>
              <span className="text-(--studio-text)">{projects.length}</span> {projects.length === 1 ? "project" : "projects"}
              {" · "}
            </>
          )}
          {trackCount > 0 && (
            <>
              <span className="text-(--studio-text)">{trackCount}</span> {trackCount === 1 ? "track" : "tracks"}
            </>
          )}
          {since && (
            <>
              {" · "}since <span className="text-(--studio-text)">{since}</span>
            </>
          )}
        </p>
      )}
    </section>
  );
}

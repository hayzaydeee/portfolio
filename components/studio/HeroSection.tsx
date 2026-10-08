"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import type { MusicProject } from "@/app/actions/studio";
import { useAudio, buildPlaylist } from "@/lib/audio/AudioContext";
import { FxStage } from "@/components/fx/FxStage";
import { Cta } from "@/components/fx/ui/Cta";
import { CircleButton } from "@/components/fx/ui/CircleButton";

function formatRuntime(tracks: MusicProject["tracks"]): string {
  const total = (tracks ?? []).reduce((s, t) => s + (t.duration_seconds ?? 0), 0);
  if (!total) return "";
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * The featured project: its artwork, and beside the details the audio wordmark, whose bars
 * follow the spectrum of whatever is playing and breathe on their own when nothing is.
 */
export function HeroSection({ project }: { project: MusicProject }) {
  const { play } = useAudio();
  const tracks = project.tracks ?? [];
  const runtime = formatRuntime(tracks);

  const handlePlay = () => {
    if (!tracks.length) return;
    const playlist = buildPlaylist(project);
    play(playlist[0], playlist);
  };

  return (
    <section className="relative w-full" aria-labelledby="studio-featured" data-studio-hero="">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-6 py-12 md:grid-cols-5">
        <div className="group relative aspect-square overflow-hidden rounded-lg md:col-span-3">
          {project.artwork_path ? (
            <Image
              src={project.artwork_path}
              alt={project.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 60vw"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-(--studio-panel)">
              <span className="text-6xl text-(--studio-text-muted)" aria-hidden="true">
                ♪
              </span>
            </div>
          )}
          {tracks.length > 0 && (
            <div className="absolute inset-0 grid place-items-center bg-(--studio-base)/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
              <CircleButton variant="glass" room="studio" label={`Play ${project.title}`} icon={<Play size={22} fill="currentColor" />} onClick={handlePlay} />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 md:col-span-2">
          <p className="font-mono text-xs tracking-widest text-(--studio-text-muted) uppercase">featured</p>
          <h2 id="studio-featured" className="font-sans text-4xl text-(--studio-text)">
            {project.title}
          </h2>
          {project.release_year && <p className="font-mono text-sm text-(--studio-text-muted)">{project.release_year}</p>}
          {project.description && <p className="text-sm leading-relaxed text-(--studio-text-muted)">{project.description}</p>}
          <div className="flex gap-6 font-mono text-sm text-(--studio-text-muted)">
            {tracks.length > 0 && (
              <span>
                <span className="text-(--studio-text)">{tracks.length}</span> {tracks.length === 1 ? "track" : "tracks"}
              </span>
            )}
            {runtime && (
              <span>
                <span className="text-(--studio-text)">{runtime}</span> runtime
              </span>
            )}
          </div>
          <FxStage effect="audio-wordmark" room="studio" className="h-24 w-full max-w-xs" />
          {tracks.length > 0 && (
            <Cta variant="beam" room="studio" label="play" icon={<Play size={14} fill="currentColor" />} onClick={handlePlay} className="self-start" />
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Play } from "lucide-react";
import type { MusicProject } from "@/app/actions/studio";
import { useAudio, buildPlaylist } from "@/lib/audio/AudioContext";

function formatRuntime(tracks: MusicProject["tracks"]): string {
  const total = (tracks ?? []).reduce((s, t) => s + (t.duration_seconds ?? 0), 0);
  if (!total) return "";
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
    <section className="relative w-full overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-5 gap-8 items-center">
        {/* Artwork — left 3/5 on desktop */}
        <motion.div
          layoutId={`artwork-${project.id}`}
          className="md:col-span-3 relative"
          style={{ aspectRatio: "1 / 1" }}
        >
          {project.artwork_path ? (
            <Image
              src={project.artwork_path}
              alt={project.title}
              fill
              className="object-cover rounded-lg"
              priority
              sizes="(max-width: 768px) 100vw, 60vw"
            />
          ) : (
            <div
              className="w-full h-full rounded-lg flex items-center justify-center"
              style={{ background: "var(--studio-panel)" }}
            >
              <span className="text-6xl opacity-20">♪</span>
            </div>
          )}
          {/* Play overlay */}
          {tracks.length > 0 && (
            <motion.button
              onClick={handlePlay}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-lg"
              style={{ background: "rgba(18, 7, 9, 0.5)" }}
              aria-label={`Play ${project.title}`}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: "var(--studio-accent)" }}
              >
                <Play size={28} fill="currentColor" style={{ color: "var(--studio-text)", marginLeft: 3 }} />
              </div>
            </motion.button>
          )}
        </motion.div>

        {/* Metadata — right 2/5 */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "var(--studio-text-muted)" }}>
            featured
          </p>
          <h1 className="text-4xl font-sans" style={{ color: "var(--studio-text)" }}>
            {project.title}
          </h1>
          {project.release_year && (
            <p className="text-sm font-mono" style={{ color: "var(--studio-text-muted)" }}>
              {project.release_year}
            </p>
          )}
          {project.description && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--studio-text-muted)" }}>
              {project.description}
            </p>
          )}
          <div className="flex gap-6 text-sm font-mono" style={{ color: "var(--studio-text-muted)" }}>
            {tracks.length > 0 && (
              <span>
                <span style={{ color: "var(--studio-text)" }}>{tracks.length}</span>{" "}
                {tracks.length === 1 ? "track" : "tracks"}
              </span>
            )}
            {runtime && (
              <span>
                <span style={{ color: "var(--studio-text)" }}>{runtime}</span> runtime
              </span>
            )}
          </div>
          {tracks.length > 0 && (
            <button
              onClick={handlePlay}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium self-start transition-colors duration-150"
              style={{ background: "var(--studio-accent)", color: "var(--studio-text)" }}
            >
              <Play size={14} fill="currentColor" />
              Play
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause } from "lucide-react";
import type { MusicProject, Track } from "@/app/actions/studio";
import { useAudio, buildPlaylist } from "@/lib/audio/AudioContext";

function WaveformIcon() {
  return (
    <motion.div className="flex items-end gap-px h-4" aria-label="playing">
      {[3, 5, 4, 6, 3].map((h, i) => (
        <motion.span
          key={i}
          className="w-px rounded-full"
          style={{ background: "var(--studio-player-accent)" }}
          animate={{ height: ["40%", "100%", "40%"] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}

function TrackRow({
  track,
  index,
  project,
  allTracks,
}: {
  track: Track;
  index: number;
  project: MusicProject;
  allTracks: Track[];
}) {
  const { currentTrack, isPlaying, play, pause, resume } = useAudio();
  const isActive = currentTrack?.id === track.id;

  const handleClick = () => {
    if (isActive) {
      isPlaying ? pause() : resume();
    } else {
      const playlist = buildPlaylist(project);
      play(playlist[index], playlist);
    }
  };

  const formatDur = (s: number | null) => {
    if (!s) return "";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      className="group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer"
      style={{ background: isActive ? "var(--studio-raised)" : "transparent" }}
      whileHover={{ background: "var(--studio-raised)" } as never}
      onClick={handleClick}
    >
      {/* Track number / play state */}
      <div className="w-6 flex items-center justify-center shrink-0">
        {isActive && isPlaying ? (
          <WaveformIcon />
        ) : isActive ? (
          <Play size={12} fill="currentColor" style={{ color: "var(--studio-player-accent)" }} />
        ) : (
          <>
            <span
              className="group-hover:hidden text-xs font-mono"
              style={{ color: "var(--studio-text-muted)" }}
            >
              {index + 1}
            </span>
            <Play
              size={12}
              fill="currentColor"
              className="hidden group-hover:block"
              style={{ color: "var(--studio-text)" }}
            />
          </>
        )}
      </div>

      {/* Title */}
      <span
        className="flex-1 text-sm truncate"
        style={{ color: isActive ? "var(--studio-text)" : "var(--studio-text-muted)" }}
      >
        {track.title}
      </span>

      {/* Duration */}
      {track.duration_seconds && (
        <span className="text-xs font-mono shrink-0" style={{ color: "var(--studio-text-muted)" }}>
          {formatDur(track.duration_seconds)}
        </span>
      )}
    </motion.div>
  );
}

function ProjectCard({ project }: { project: MusicProject }) {
  const [expanded, setExpanded] = useState(false);
  const { play, pause, isPlaying, currentTrack } = useAudio();
  const tracks = project.tracks ?? [];
  const isProjectPlaying = tracks.some((t) => t.id === currentTrack?.id) && isPlaying;

  const handleArtworkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tracks.length) return;
    if (isProjectPlaying) {
      pause();
    } else {
      const playlist = buildPlaylist(project);
      play(playlist[0], playlist);
    }
  };

  return (
    <motion.div
      layout
      className="rounded-xl overflow-hidden cursor-pointer"
      style={{ background: "var(--studio-panel)", border: "1px solid var(--studio-border)" }}
      onClick={() => setExpanded((e) => !e)}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!expanded ? (
          /* Collapsed card */
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Artwork */}
            <div
              className="relative group"
              style={{ aspectRatio: "1 / 1" }}
              onClick={handleArtworkClick}
            >
              {project.artwork_path ? (
                <Image
                  src={project.artwork_path}
                  alt={project.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "var(--studio-raised)" }}
                >
                  <span className="text-4xl opacity-20">♪</span>
                </div>
              )}
              {/* Play overlay on artwork hover */}
              {tracks.length > 0 && (
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  style={{ background: "rgba(18,7,9,0.55)" }}
                >
                  {isProjectPlaying ? (
                    <Pause size={28} fill="currentColor" style={{ color: "var(--studio-text)" }} />
                  ) : (
                    <Play
                      size={28}
                      fill="currentColor"
                      style={{ color: "var(--studio-text)", marginLeft: 3 }}
                    />
                  )}
                </div>
              )}
            </div>
            {/* Metadata */}
            <div className="p-3">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--studio-text)" }}
              >
                {project.title}
              </p>
              <div
                className="text-xs font-mono mt-1 flex gap-2"
                style={{ color: "var(--studio-text-muted)" }}
              >
                {project.release_year && <span>{project.release_year}</span>}
                {tracks.length > 0 && (
                  <span>
                    {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          /* Expanded card */
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="p-4"
          >
            <div className="flex gap-4 mb-4">
              {/* Small artwork */}
              <div
                className="relative w-16 h-16 rounded-lg shrink-0 overflow-hidden"
                style={{ background: "var(--studio-raised)" }}
              >
                {project.artwork_path && (
                  <Image
                    src={project.artwork_path}
                    alt={project.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm" style={{ color: "var(--studio-text)" }}>
                  {project.title}
                </p>
                {project.release_year && (
                  <p className="text-xs font-mono mt-0.5" style={{ color: "var(--studio-text-muted)" }}>
                    {project.release_year}
                  </p>
                )}
                {project.description && (
                  <p
                    className="text-xs mt-1 leading-relaxed"
                    style={{ color: "var(--studio-text-muted)" }}
                  >
                    {project.description}
                  </p>
                )}
              </div>
            </div>

            {/* Tracklist */}
            {tracks.length > 0 ? (
              <div
                className="rounded-lg overflow-hidden"
                style={{ background: "var(--studio-base)" }}
                onClick={(e) => e.stopPropagation()}
              >
                {tracks.map((track, i) => (
                  <TrackRow key={track.id} track={track} index={i} project={project} allTracks={tracks} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-center py-4" style={{ color: "var(--studio-text-muted)" }}>
                No tracks yet
              </p>
            )}

            <button
              className="mt-3 text-xs w-full text-center"
              style={{ color: "var(--studio-text-muted)" }}
            >
              ↑ collapse
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ProjectsGrid({ projects }: { projects: MusicProject[] }) {
  if (!projects.length) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      <h2 className="text-xs font-mono uppercase tracking-widest mb-6" style={{ color: "var(--studio-text-muted)" }}>
        projects
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </section>
  );
}

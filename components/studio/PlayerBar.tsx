"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Link } from "lucide-react";
import { useAudio } from "@/lib/audio/AudioContext";
import { useCallback } from "react";

function formatTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    volume,
    loop,
    progress,
    duration,
    currentTime,
    play,
    pause,
    resume,
    seek,
    next,
    prev,
    setVolume,
    toggleLoop,
  } = useAudio();

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      seek(ratio * duration);
    },
    [seek, duration]
  );

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  }, []);

  return (
    <AnimatePresence>
      {currentTrack && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-0 left-0 right-0 z-50"
          style={{
            background: "var(--studio-player-bg)",
            borderTop: "1px solid rgba(240,230,232,0.1)",
          }}
        >
          {/* Progress bar (full width, above controls) */}
          <div
            className="relative w-full h-0.5 cursor-pointer group"
            style={{ background: "rgba(240,230,232,0.08)" }}
            onClick={handleProgressClick}
          >
            <div
              className="absolute inset-y-0 left-0 transition-[width] duration-100"
              style={{
                width: `${progress * 100}%`,
                background: "var(--studio-player-accent)",
              }}
            />
            {/* Hover hit area */}
            <div className="absolute inset-0 -top-2 -bottom-2" />
          </div>

          <div className="flex items-center px-4 py-3 gap-4">
            {/* Left — track info */}
            <div className="flex items-center gap-3 w-48 shrink-0">
              <div
                className="relative w-10 h-10 rounded shrink-0 overflow-hidden"
                style={{ background: "var(--studio-raised)" }}
              >
                {currentTrack.artworkPath && (
                  <Image
                    src={currentTrack.artworkPath}
                    alt={currentTrack.title}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className="text-xs font-medium truncate"
                  style={{ color: "var(--studio-text)" }}
                >
                  {currentTrack.title}
                </p>
                {currentTrack.projectTitle && (
                  <p className="text-[10px] truncate" style={{ color: "var(--studio-text-muted)" }}>
                    {currentTrack.projectTitle}
                  </p>
                )}
              </div>
            </div>

            {/* Centre — controls + time */}
            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-center gap-4">
                <button
                  onClick={prev}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                  aria-label="Previous"
                >
                  <SkipBack size={16} style={{ color: "var(--studio-text)" }} />
                </button>
                <button
                  onClick={isPlaying ? pause : resume}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-150"
                  style={{ background: "var(--studio-accent)" }}
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <Pause size={14} fill="currentColor" style={{ color: "var(--studio-text)" }} />
                  ) : (
                    <Play
                      size={14}
                      fill="currentColor"
                      style={{ color: "var(--studio-text)", marginLeft: 1 }}
                    />
                  )}
                </button>
                <button
                  onClick={next}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                  aria-label="Next"
                >
                  <SkipForward size={16} style={{ color: "var(--studio-text)" }} />
                </button>
              </div>

              <div className="flex items-center gap-2 w-full max-w-sm">
                <span
                  className="text-[10px] font-mono w-8 text-right shrink-0"
                  style={{ color: "var(--studio-text-muted)" }}
                >
                  {formatTime(currentTime)}
                </span>
                <div
                  className="relative flex-1 h-0.5 cursor-pointer rounded-full"
                  style={{ background: "rgba(240,230,232,0.12)" }}
                  onClick={handleProgressClick}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${progress * 100}%`,
                      background: "var(--studio-player-accent)",
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-mono w-8 shrink-0"
                  style={{ color: "var(--studio-text-muted)" }}
                >
                  {formatTime(duration)}
                </span>
              </div>
            </div>

            {/* Right — volume + loop + link */}
            <div className="flex items-center gap-3 w-48 justify-end shrink-0">
              <button
                onClick={toggleLoop}
                className="transition-opacity"
                style={{ opacity: loop ? 1 : 0.4, color: "var(--studio-player-accent)" }}
                aria-label="Toggle loop"
                aria-pressed={loop}
              >
                <Repeat size={14} />
              </button>

              <div className="flex items-center gap-1.5">
                <Volume2 size={12} style={{ color: "var(--studio-text-muted)" }} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-16 accent-(--studio-player-accent)"
                  aria-label="Volume"
                />
              </div>

              <button
                onClick={handleCopyLink}
                className="opacity-50 hover:opacity-100 transition-opacity"
                aria-label="Copy link"
              >
                <Link size={13} style={{ color: "var(--studio-text)" }} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

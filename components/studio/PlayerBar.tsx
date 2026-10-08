"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Link } from "lucide-react";
import { useCallback } from "react";
import { useAudio, useAudioTime } from "@/lib/audio/AudioContext";
import { useStudioPlayer } from "@/lib/audio/studioPlayer";
import { FxStage } from "@/components/fx/FxStage";
import { CircleButton } from "@/components/fx/ui/CircleButton";
import { LiquidKey } from "./LiquidKey";

function formatTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * The persistent player. Light rises off its top edge with the music; in the studio its play
 * key is liquid metal, and everywhere else a glass circle button. Prev, next and loop are
 * hairline circle buttons; loop announces its state as pressed and lights its icon.
 */
export function PlayerBar() {
  const { currentTrack, isPlaying, volume, loop, pause, resume, seek, next, prev, setVolume, toggleLoop } = useAudio();
  const { progress, duration, currentTime } = useAudioTime();
  const studio = useStudioPlayer();

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

  const playLabel = isPlaying ? "Pause" : "Play";
  const playIcon = isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="translate-x-px" />;
  const toggle = isPlaying ? pause : resume;

  return (
    <AnimatePresence>
      {currentTrack && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          data-portal-keep
          data-player-bar=""
          className="fixed right-0 bottom-0 left-0 z-(--z-player) border-t border-(--studio-border) bg-(--studio-player-bg)"
        >
          <FxStage
            effect="player-glow"
            room="studio"
            className="pointer-events-none absolute inset-x-0 bottom-full h-16"
            posterClassName="bg-transparent"
          />

          {/* Progress bar (full width, above controls) */}
          <div className="group relative h-0.5 w-full cursor-pointer bg-(--studio-text)/8" onClick={handleProgressClick}>
            <div
              className="absolute inset-y-0 left-0 bg-(--studio-player-accent) transition-[width] duration-100"
              style={{ width: `${progress * 100}%` }}
            />
            {/* Hover hit area */}
            <div className="absolute inset-0 -top-2 -bottom-2" />
          </div>

          <div className="flex items-center gap-4 px-4 py-3">
            {/* Left: track info */}
            <div className="flex min-w-0 flex-1 items-center gap-3 md:w-48 md:flex-none">
              <div className="relative size-10 shrink-0 overflow-hidden rounded bg-(--studio-raised)">
                {currentTrack.artworkPath && (
                  <Image src={currentTrack.artworkPath} alt={currentTrack.title} fill className="object-cover" sizes="40px" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-(--studio-text)">{currentTrack.title}</p>
                {currentTrack.projectTitle && <p className="truncate text-[10px] text-(--studio-text-muted)">{currentTrack.projectTitle}</p>}
              </div>
            </div>

            {/* Centre: controls, and the time from md up (the top line carries progress on a phone) */}
            <div className="flex shrink-0 flex-col items-center gap-1 md:flex-1">
              <div className="flex items-center gap-3">
                <CircleButton variant="trace" size="sm" room="studio" label="Previous" icon={<SkipBack size={14} />} onClick={prev} />
                {studio ? (
                  <LiquidKey label={playLabel} icon={playIcon} onClick={toggle} />
                ) : (
                  <CircleButton variant="glass" size="sm" room="studio" label={playLabel} icon={playIcon} onClick={toggle} />
                )}
                <CircleButton variant="trace" size="sm" room="studio" label="Next" icon={<SkipForward size={14} />} onClick={next} />
              </div>

              <div className="hidden w-full max-w-sm items-center gap-2 md:flex">
                <span className="w-8 shrink-0 text-right font-mono text-[10px] text-(--studio-text-muted)">{formatTime(currentTime)}</span>
                <div className="relative h-0.5 flex-1 cursor-pointer rounded-full bg-(--studio-text)/12" onClick={handleProgressClick}>
                  <div className="absolute inset-y-0 left-0 rounded-full bg-(--studio-player-accent)" style={{ width: `${progress * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 font-mono text-[10px] text-(--studio-text-muted)">{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right: loop, and volume and link from md up (a phone has its own volume) */}
            <div className="flex shrink-0 items-center justify-end gap-3 md:w-48">
              <CircleButton
                variant="trace"
                size="sm"
                room="studio"
                label="Loop"
                pressed={loop}
                icon={<Repeat size={13} />}
                onClick={toggleLoop}
              />

              <div className="hidden items-center gap-1.5 md:flex">
                <Volume2 size={12} className="text-(--studio-text-muted)" />
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
                type="button"
                onClick={handleCopyLink}
                className="hidden text-(--studio-text) opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 md:block"
                aria-label="Copy link"
              >
                <Link size={13} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

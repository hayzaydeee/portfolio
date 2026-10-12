"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { WallPiece } from "@/lib/data/wall";
import { getImageUrl, getScatterProps } from "@/lib/wall-utils";
import { formatPinned } from "@/lib/wall/format";
import type { PinnedPiece } from "@/lib/wall/placeholders";
import { useDevelop, useTilt } from "./polaroidMotion";

export function Pin() {
  return (
    <svg
      width="12"
      height="16"
      viewBox="0 0 12 16"
      aria-hidden="true"
      className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 transition-transform duration-150 ease-out group-hover:rotate-3"
    >
      <circle cx="6" cy="4" r="4" className="fill-(--wall-pin)" />
      <line x1="6" y1="7" x2="6" y2="15" strokeWidth="1.5" strokeLinecap="round" className="stroke-(--wall-pin)" />
    </svg>
  );
}

export function TypeBadge({ type }: { type: WallPiece["type"] }) {
  return (
    <span className="absolute right-2 bottom-2 z-2 flex size-6 items-center justify-center rounded-sm bg-(--wall-polaroid)/70" aria-hidden="true">
      {type === "art" ? (
        <svg width="12" height="12" viewBox="0 0 12 12">
          <circle cx="3" cy="3" r="2" className="fill-(--admin-accent-wall)" />
          <circle cx="9" cy="3" r="2" className="fill-(--wall-date)" />
          <circle cx="6" cy="9" r="2" className="fill-(--wall-pin)" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 10 10">
          <polygon points="2,1 9,5 2,9" className="fill-(--wall-caption)" />
        </svg>
      )}
    </span>
  );
}

/** The seeded scatter a piece is pinned at, tightened to sit in a grid cell */
export function scatterVars(id: string) {
  const s = getScatterProps(id);
  return {
    "--r": `${s.rotation.toFixed(2)}deg`,
    "--sx": `${((s.offsetX - 20) * 0.4).toFixed(1)}px`,
    "--sy": `${((s.offsetY - 30) * 0.4).toFixed(1)}px`,
  } as React.CSSProperties;
}

export const FRAME = "relative w-38 rounded-sm bg-(--wall-polaroid) p-2 pb-8 shadow-[0_6px_24px_var(--wall-shadow)] sm:w-40";

/**
 * One piece pinned to the wall. Art opens in the lightbox; a video with a preview plays in the
 * frame, and one without links out to where it lives. The whole frame is the target, through
 * one real button (or link) laid over it, so the controls inside a playing video stay their
 * own buttons rather than nested ones.
 */
export function Polaroid({ piece, onOpen }: { piece: PinnedPiece; onOpen: (piece: WallPiece) => void }) {
  const tilt = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [video, setVideo] = useState<"idle" | "playing" | "ended">("idle");
  const [muted, setMuted] = useState(true);
  const imageUrl = getImageUrl(piece.image_path);
  const previewUrl = getImageUrl(piece.preview_path);
  const isVideo = piece.type !== "art";
  useTilt(tilt);
  const develop = useDevelop(photo, Boolean(imageUrl));

  const name = piece.caption ?? piece.alt_text ?? (isVideo ? "a video" : "a piece");
  const play = () => {
    if (video !== "idle") return;
    setVideo("playing");
    requestAnimationFrame(() => void videoRef.current?.play().catch(() => setVideo("idle")));
  };
  const close = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    setVideo("idle");
  };

  let target: React.ReactNode = null;
  const targetClass =
    "absolute inset-0 z-10 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--wall-pin)";
  if (!isVideo) {
    target = <button type="button" className={`${targetClass} cursor-zoom-in`} aria-label={`Open ${name}`} onClick={() => onOpen(piece)} />;
  } else if (previewUrl) {
    target = video === "idle" ? <button type="button" className={`${targetClass} cursor-pointer`} aria-label={`Play ${name}`} onClick={play} /> : null;
  } else if (piece.youtube_url) {
    target = (
      <a href={piece.youtube_url} target="_blank" rel="noopener noreferrer" className={targetClass} aria-label={`Watch ${name} (opens in a new tab)`} />
    );
  }

  return (
    <div className="relative rotate-(--r) translate-x-(--sx) translate-y-(--sy) hover:z-20 has-focus-visible:z-20" style={scatterVars(piece.id)}>
      <motion.div layoutId={`polaroid-${piece.id}`} className="polaroid-lift group">
        <div ref={tilt} className="polaroid-tilt">
          <div className={FRAME} data-polaroid={piece.id} data-develop={develop}>
            <Pin />
            <span ref={photo} className="relative block aspect-square overflow-hidden rounded-sm bg-(--wall-texture)">
              {!imageUrl && video === "idle" && (
                <span className="flex h-full w-full items-end justify-end bg-(--swatch) p-2" style={{ "--swatch": piece.swatch ?? "var(--wall-texture)" } as React.CSSProperties}>
                  <span className="font-mono text-[9px] text-(--wall-polaroid)/50">early work</span>
                </span>
              )}
              {imageUrl && video === "idle" && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt={piece.alt_text ?? piece.caption ?? ""} className="develop-photo h-full w-full object-cover" draggable={false} />
              )}
              {imageUrl && <span className="develop-veil" aria-hidden="true" />}

              {isVideo && previewUrl && video !== "idle" && (
                <>
                  <video ref={videoRef} src={previewUrl} muted={muted} playsInline className="h-full w-full object-cover" onEnded={() => setVideo("ended")} />
                  <button
                    type="button"
                    className="absolute top-2 right-2 z-20 flex size-6 items-center justify-center rounded-full bg-(--wall-caption)/55 text-(--wall-polaroid)/90"
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? "Unmute" : "Mute"}
                    aria-pressed={!muted}
                  >
                    {muted ? (
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                        <path d="M1 3h2l3-2v8L3 7H1V3z" className="fill-current" />
                        <line x1="7" y1="3" x2="9" y2="7" stroke="currentColor" strokeWidth="1" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                        <path d="M1 3h2l3-2v8L3 7H1V3z" className="fill-current" />
                        <path d="M7 4c.5.5.5 1.5 0 2M8 2.5c1 1 1 4 0 5" stroke="currentColor" strokeWidth="1" fill="none" />
                      </svg>
                    )}
                  </button>
                </>
              )}

              <AnimatePresence>
                {video === "ended" && (
                  <motion.span
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 40, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between bg-(--wall-caption)/80 px-2 py-1.5"
                  >
                    {piece.youtube_url ? (
                      <a href={piece.youtube_url} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-(--wall-polaroid)/90">
                        watch in full →
                      </a>
                    ) : (
                      <span />
                    )}
                    <button type="button" className="font-mono text-[10px] text-(--wall-polaroid)/60" onClick={close}>
                      close ✕
                    </button>
                  </motion.span>
                )}
              </AnimatePresence>

              <TypeBadge type={piece.type} />
              {piece.type === "video_long" && piece.duration && video === "idle" && (
                <span className="absolute bottom-2 left-2 z-2 rounded-sm bg-(--wall-caption)/65 px-1.5 py-0.5 font-mono text-[10px] text-(--wall-polaroid)/90">
                  {piece.duration}
                </span>
              )}
            </span>

            <span className="block px-1 pt-2">
              {piece.caption && <span className="line-clamp-2 block font-script text-xs leading-tight text-(--wall-caption)">{piece.caption}</span>}
              <span className="mt-0.5 block font-mono text-[9px] text-(--wall-date)">{formatPinned(piece.created_at)}</span>
            </span>
            {target}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

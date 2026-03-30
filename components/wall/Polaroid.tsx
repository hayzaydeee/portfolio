"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { WallPiece } from "@/lib/data/wall";
import { getImageUrl } from "@/lib/wall-utils";

// ── Pin SVG ────────────────────────────────────────────────────────────
function Pin({ hover }: { hover: boolean }) {
  return (
    <motion.svg
      width="12"
      height="16"
      viewBox="0 0 12 16"
      className="absolute -top-3 left-1/2 -translate-x-1/2 z-20"
      animate={{ rotate: hover ? 3 : 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {/* Pin head */}
      <circle cx="6" cy="4" r="4" fill="var(--wall-pin)" />
      {/* Pin needle */}
      <line x1="6" y1="7" x2="6" y2="15" stroke="var(--wall-pin)" strokeWidth="1.5" strokeLinecap="round" />
    </motion.svg>
  );
}

// ── Type badge ─────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: WallPiece["type"] }) {
  if (type === "art") {
    return (
      <div
        className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded-sm"
        style={{ background: "rgba(250,246,240,0.7)" }}
        aria-label="Art"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="3" cy="3" r="2" fill="#C4855A" />
          <circle cx="9" cy="3" r="2" fill="#5A8AC4" />
          <circle cx="6" cy="9" r="2" fill="#4A916B" />
        </svg>
      </div>
    );
  }
  return (
    <div
      className="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center rounded-sm"
      style={{ background: "rgba(250,246,240,0.7)" }}
      aria-label="Video"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <polygon points="2,1 9,5 2,9" fill="var(--wall-caption)" />
      </svg>
    </div>
  );
}

// ── Duration badge ─────────────────────────────────────────────────────
function DurationBadge({ duration }: { duration: string }) {
  return (
    <div
      className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-sm text-[10px] font-mono"
      style={{
        background: "rgba(42,32,24,0.65)",
        color: "rgba(250,246,240,0.9)",
      }}
    >
      {duration}
    </div>
  );
}

// ── Sealed state ───────────────────────────────────────────────────────
function SealedOverlay({ publishAt }: { publishAt: string }) {
  const date = new Date(publishAt);
  const label = date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-sm">
      {/* Wax seal */}
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22" fill="#C4392A" opacity="0.9" />
        <text
          x="24"
          y="28"
          textAnchor="middle"
          fontSize="14"
          fontWeight="bold"
          fill="rgba(250,246,240,0.9)"
          fontFamily="serif"
        >
          hzy
        </text>
      </svg>
      <p
        className="text-[10px] font-mono text-center mt-2 px-2"
        style={{ color: "rgba(250,246,240,0.7)" }}
      >
        unseals {label.toLowerCase()}
      </p>
    </div>
  );
}

// ── Polaroid card ──────────────────────────────────────────────────────
export type PolaroidProps = {
  piece: WallPiece & { _placeholderColor?: string };
  index: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  onOpenLightbox: (piece: WallPiece) => void;
};

export function Polaroid({
  piece,
  index,
  rotation,
  offsetX,
  offsetY,
  onOpenLightbox,
}: PolaroidProps) {
  const [hover, setHover] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [videoState, setVideoState] = useState<"idle" | "playing" | "ended">("idle");
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Entrance drop — client-only so it never causes an SSR/hydration mismatch
  useEffect(() => {
    const t = setTimeout(() => setDropped(true), index * 50);
    return () => clearTimeout(t);
  }, [index]);

  const isSealed =
    piece.status === "scheduled" &&
    piece.publish_at &&
    new Date(piece.publish_at) > new Date();

  const isVideo = piece.type === "video_short" || piece.type === "video_long";
  const imageUrl = getImageUrl(piece.image_path);
  const previewUrl = getImageUrl(piece.preview_path);

  function handleClick() {
    if (isSealed) return;
    if (piece.type === "art") {
      onOpenLightbox(piece);
      return;
    }
    if (videoState === "idle" && previewUrl) {
      setVideoState("playing");
      setTimeout(() => videoRef.current?.play(), 50);
    }
  }

  function handleVideoEnded() {
    setVideoState("ended");
  }

  function handleClose() {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setVideoState("idle");
  }

  return (
    <div
      suppressHydrationWarning
      style={{
        // Static scatter — plain CSS, never touches Framer Motion serialization
        transform: `translateX(${offsetX}px) translateY(${offsetY}px) rotate(${rotation}deg)`,
        zIndex: hover ? 30 : 10 - index,
        cursor: isSealed ? "default" : "pointer",
        // Entrance drop — CSS transition, client-only via `dropped` state
        opacity: dropped ? 1 : 0,
        translate: dropped ? "0 0" : "0 -32px",
        transition: dropped
          ? `opacity 0.4s ease ${index * 0.05}s, translate 0.4s cubic-bezier(0.22,1,0.36,1) ${index * 0.05}s`
          : "none",
      }}
    >
    <motion.div
      layoutId={`polaroid-${piece.id}`}
      className="relative shrink-0"
      whileHover={
        !isSealed
          ? {
              y: -6,
              scale: 1.03,
              transition: { duration: 0.2, ease: "easeOut" },
            }
          : {}
      }
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      onClick={handleClick}
    >
      <Pin hover={hover && !isSealed} />

      {/* Polaroid frame */}
      <div
        className="relative rounded-sm overflow-visible"
        style={{
          background: "var(--wall-polaroid)",
          boxShadow: hover && !isSealed
            ? "0 20px 50px rgba(28,22,16,0.28), 0 6px 16px rgba(28,22,16,0.18)"
            : "0 6px 24px var(--wall-shadow)",
          padding: "8px 8px 32px 8px",
          width: 160,
        }}
      >
        {/* Photo area */}
        <div
          className="relative overflow-hidden rounded-sm"
          style={{ width: 144, height: 144, background: "#d8d0c0" }}
        >
          {/* Placeholder swatch — shown when no image is available */}
          {!imageUrl && videoState === "idle" && (
            <div
              className="w-full h-full flex items-end justify-end p-2"
              style={{
                background: (piece as WallPiece & { _placeholderColor?: string })._placeholderColor ?? "#c8bfb0",
              }}
            >
              <span
                className="text-[9px] font-mono opacity-50"
                style={{ color: "rgba(250,246,240,0.8)" }}
              >
                early work
              </span>
            </div>
          )}

          {imageUrl && videoState === "idle" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt={piece.alt_text ?? piece.caption ?? ""}
              className="w-full h-full object-cover"
              draggable={false}
            />
          )}

          {/* Video player */}
          {isVideo && previewUrl && videoState !== "idle" && (
            <>
              <video
                ref={videoRef}
                src={previewUrl}
                muted={muted}
                playsInline
                className="w-full h-full object-cover"
                onEnded={handleVideoEnded}
              />
              {/* Mute toggle */}
              <button
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full transition-opacity"
                style={{ background: "rgba(42,32,24,0.55)", color: "rgba(250,246,240,0.9)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setMuted((m) => !m);
                }}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M1 3h2l3-2v8L3 7H1V3zM8 3l1 1-1 1M8 6l1 1" stroke="currentColor" strokeWidth="1" fill="none" />
                    <line x1="7" y1="3" x2="9" y2="7" stroke="currentColor" strokeWidth="1" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                    <path d="M1 3h2l3-2v8L3 7H1V3z" />
                    <path d="M7 4c.5.5.5 1.5 0 2M8 2.5c1 1 1 4 0 5" stroke="currentColor" strokeWidth="1" fill="none" />
                  </svg>
                )}
              </button>
            </>
          )}

          {/* Video ended — actions */}
          <AnimatePresence>
            {videoState === "ended" && (
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5"
                style={{ background: "rgba(42,32,24,0.8)" }}
              >
                {piece.youtube_url ? (
                  <a
                    href={piece.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono"
                    style={{ color: "rgba(250,246,240,0.9)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    watch in full →
                  </a>
                ) : (
                  <span />
                )}
                <button
                  className="text-[10px] font-mono"
                  style={{ color: "rgba(250,246,240,0.6)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                  }}
                >
                  close ✕
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Type badge */}
          {!isSealed && <TypeBadge type={piece.type} />}

          {/* Duration badge for long video */}
          {piece.type === "video_long" && piece.duration && videoState === "idle" && (
            <DurationBadge duration={piece.duration} />
          )}

          {/* Sealed overlay */}
          {isSealed && piece.publish_at && (
            <SealedOverlay publishAt={piece.publish_at} />
          )}
        </div>

        {/* Caption area */}
        <div className="px-1 pt-2">
          {piece.caption && (
            <p
              className="font-script text-xs leading-tight line-clamp-2"
              style={{ color: "var(--wall-caption)" }}
            >
              {piece.caption}
            </p>
          )}
          <p
            className="text-[9px] font-mono mt-0.5"
            style={{ color: "var(--wall-date)" }}
          >
            {new Date(piece.created_at).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    </motion.div>
    </div>
  );
}

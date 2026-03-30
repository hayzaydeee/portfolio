"use client";

import { useState, useEffect, useCallback } from "react";
import type { WallPiece } from "@/lib/data/wall";
import { getScatterProps } from "@/lib/wall-utils";
import { Polaroid } from "@/components/wall/Polaroid";
import { Lightbox } from "@/components/wall/Lightbox";

// ── Placeholder pieces shown while the wall is empty ──────────────────
const PLACEHOLDER_PIECES: WallPiece[] = [
  {
    id: "placeholder-1",
    type: "art",
    caption: "first time I got this right",
    description: "early sketch — rough around the edges, but something in it",
    image_path: null,
    preview_path: null,
    youtube_url: null,
    duration: null,
    alt_text: "A pencil study, early work",
    status: "published",
    publish_at: null,
    created_at: "2026-01-10T00:00:00Z",
    _placeholderColor: "#C4855A",
  } as WallPiece & { _placeholderColor: string },
  {
    id: "placeholder-2",
    type: "art",
    caption: "made this at 2am, don't remember why",
    description: null,
    image_path: null,
    preview_path: null,
    youtube_url: null,
    duration: null,
    alt_text: "Abstract ink study",
    status: "published",
    publish_at: null,
    created_at: "2026-01-28T00:00:00Z",
    _placeholderColor: "#4A6B4A",
  } as WallPiece & { _placeholderColor: string },
  {
    id: "placeholder-3",
    type: "art",
    caption: "this one took three weeks",
    description: null,
    image_path: null,
    preview_path: null,
    youtube_url: null,
    duration: null,
    alt_text: "Detailed charcoal drawing",
    status: "published",
    publish_at: null,
    created_at: "2026-02-14T00:00:00Z",
    _placeholderColor: "#1E2E5A",
  } as WallPiece & { _placeholderColor: string },
  {
    id: "placeholder-4",
    type: "video_short",
    caption: "been thinking about this scene for months",
    description: null,
    image_path: null,
    preview_path: null,
    youtube_url: "https://youtube.com",
    duration: null,
    alt_text: "Short film clip",
    status: "published",
    publish_at: null,
    created_at: "2026-02-20T00:00:00Z",
    _placeholderColor: "#6B1E2E",
  } as WallPiece & { _placeholderColor: string },
  {
    id: "placeholder-5",
    type: "art",
    caption: "WIP — not sure where this is going yet",
    description: null,
    image_path: null,
    preview_path: null,
    youtube_url: null,
    duration: null,
    alt_text: "Work in progress",
    status: "published",
    publish_at: null,
    created_at: "2026-03-01T00:00:00Z",
    _placeholderColor: "#2A2E35",
  } as WallPiece & { _placeholderColor: string },
  {
    id: "placeholder-6",
    type: "art",
    caption: "reference study",
    description: null,
    image_path: null,
    preview_path: null,
    youtube_url: null,
    duration: null,
    alt_text: "Reference study",
    status: "scheduled",
    publish_at: "2026-06-28T00:00:00Z",
    created_at: "2026-03-15T00:00:00Z",
    _placeholderColor: "#7A4F1E",
  } as WallPiece & { _placeholderColor: string },
];

type Props = {
  pieces: WallPiece[];
};

export function WallPage({ pieces }: Props) {
  const [lightboxPiece, setLightboxPiece] = useState<WallPiece | null>(null);

  // Close lightbox on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setLightboxPiece(null);
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Use real pieces or placeholders
  const displayPieces = pieces.length > 0 ? pieces : PLACEHOLDER_PIECES;

  // Pre-compute scatter so it's stable across renders
  const scatterList = displayPieces.map((p) => ({ piece: p, ...getScatterProps(p.id) }));

  return (
    <>
      {/* Wall surface */}
      <div
        className="relative min-h-screen overflow-hidden"
        style={{ background: "var(--wall-surface)" }}
      >
        {/* Grain texture overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          aria-hidden="true"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.5'/%3E%3C/svg%3E\")",
            backgroundSize: "200px 200px",
          }}
        />

        {/* Back nav */}
        <div className="relative z-10 px-6 pt-6">
          <a
            href="/"
            className="text-xs font-mono transition-opacity duration-150 opacity-60 hover:opacity-100"
            style={{ color: "var(--wall-caption)" }}
          >
            ← hzy
          </a>
        </div>

        {/* Scatter canvas — absolute positioned polaroids */}
        <div
          className="relative mx-auto"
          style={{
            minHeight: 800,
            maxWidth: 960,
            padding: "60px 80px 120px",
          }}
        >
          {scatterList.map(({ piece, rotation, offsetX, offsetY }, i) => (
            <div
              key={piece.id}
              className="absolute"
              style={{
                left: `${10 + (i % 5) * 18}%`,
                top: `${60 + Math.floor(i / 5) * 220}px`,
              }}
            >
              <Polaroid
                piece={piece}
                index={i}
                rotation={rotation}
                offsetX={offsetX}
                offsetY={offsetY}
                onOpenLightbox={setLightboxPiece}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox piece={lightboxPiece} onClose={() => setLightboxPiece(null)} />
    </>
  );
}

"use client";

import { motion, AnimatePresence } from "motion/react";
import type { WallPiece } from "@/lib/data/wall";
import { getImageUrl } from "@/lib/wall-utils";

type Props = {
  piece: WallPiece | null;
  onClose: () => void;
};

export function Lightbox({ piece, onClose }: Props) {
  const imageUrl = getImageUrl(piece?.image_path ?? null);

  return (
    <AnimatePresence>
      {piece && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 backdrop-blur-sm"
            style={{ background: "rgba(42,32,24,0.7)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-label="Close lightbox"
          />

          {/* Expanded polaroid */}
          <motion.div
            key={`lightbox-${piece.id}`}
            layoutId={`polaroid-${piece.id}`}
            className="fixed z-50 top-1/2 left-1/2"
            style={{
              translateX: "-50%",
              translateY: "-50%",
            }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="rounded-sm overflow-visible"
              style={{
                background: "var(--wall-polaroid)",
                boxShadow: "0 32px 80px rgba(28,22,16,0.4)",
                padding: "12px 12px 56px 12px",
                maxWidth: "min(90vw, 520px)",
              }}
            >
              {/* Image */}
              <div
                className="relative overflow-hidden rounded-sm"
                style={{ width: "100%", aspectRatio: "1 / 1" }}
              >
                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={piece.alt_text ?? piece.caption ?? ""}
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                )}
              </div>

              {/* Caption */}
              <div className="px-1 pt-3">
                {piece.caption && (
                  <p
                    className="font-script text-base leading-snug"
                    style={{ color: "var(--wall-caption)" }}
                  >
                    {piece.caption}
                  </p>
                )}
                {piece.description && (
                  <p
                    className="font-serif text-sm leading-relaxed mt-2"
                    style={{ color: "var(--wall-caption)", opacity: 0.75 }}
                  >
                    {piece.description}
                  </p>
                )}
                <p
                  className="text-[10px] font-mono mt-1"
                  style={{ color: "var(--wall-date)" }}
                >
                  {new Date(piece.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Close button */}
          <motion.button
            key="close"
            className="fixed top-6 right-6 z-50 w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors"
            style={{
              background: "rgba(250,246,240,0.15)",
              color: "rgba(250,246,240,0.8)",
            }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close"
          >
            ✕
          </motion.button>
        </>
      )}
    </AnimatePresence>
  );
}

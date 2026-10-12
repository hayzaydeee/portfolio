"use client";

import { useEffect, useState } from "react";
import { getImageUrl } from "@/lib/wall-utils";
import type { PinnedPiece } from "@/lib/wall/placeholders";

const PLATES = 12;

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** A piece's colour: the average of its image, pulled halfway toward its most vivid pixel */
function colourOfImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 12;
        const g = c.getContext("2d", { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, 12, 12);
        const d = g.getImageData(0, 0, 12, 12).data;
        let r = 0;
        let gr = 0;
        let b = 0;
        let best = -1;
        let vivid = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          gr += d[i + 1];
          b += d[i + 2];
          const mx = Math.max(d[i], d[i + 1], d[i + 2]);
          const mn = Math.min(d[i], d[i + 1], d[i + 2]);
          const score = (mx - mn) * mx;
          if (score > best) {
            best = score;
            vivid = [d[i], d[i + 1], d[i + 2]];
          }
        }
        const n = d.length / 4;
        resolve(hex((r / n + vivid[0]) / 2, (gr / n + vivid[1]) / 2, (b / n + vivid[2]) / 2));
      } catch {
        // A cross-origin image that won't share its pixels: leave it out
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function colourOf(piece: PinnedPiece): Promise<string | null> {
  if (piece.swatch) return Promise.resolve(piece.swatch);
  const url = getImageUrl(piece.image_path);
  return url ? colourOfImage(url) : Promise.resolve(null);
}

/**
 * Twelve plate colours for the wall's heading, taken from the pieces on it. With fewer than six
 * pieces, their colours alternate with the wall's own paper and ink, so the ring doesn't repeat
 * one colour round itself. Empty until they've been read; the ring keeps its own palette till then.
 */
export function usePieceColours(pieces: PinnedPiece[]): string[] {
  const [colours, setColours] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all(pieces.slice(0, PLATES).map(colourOf)).then((list) => {
      const found = list.filter((c): c is string => c !== null);
      if (cancelled || !found.length) return;
      const root = getComputedStyle(document.documentElement);
      const neutrals = ["--wall-polaroid", "--wall-caption", "--wall-texture"].map((v) => root.getPropertyValue(v).trim()).filter(Boolean);
      const plates = Array.from({ length: PLATES }, (_, i) =>
        found.length >= 6 || !neutrals.length || i % 2 === 0 ? found[Math.floor(found.length >= 6 ? i : i / 2) % found.length] : neutrals[Math.floor(i / 2) % neutrals.length]
      );
      setColours(plates);
    });
    return () => {
      cancelled = true;
    };
  }, [pieces]);
  return colours;
}

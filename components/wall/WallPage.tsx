"use client";

import { useEffect, useState } from "react";
import type { SealedPiece, WallPiece } from "@/lib/data/wall";
import { PLACEHOLDER_PIECES, type PinnedPiece } from "@/lib/wall/placeholders";
import { Polaroid } from "@/components/wall/Polaroid";
import { SealedPolaroid } from "@/components/wall/SealedPolaroid";
import { Lightbox } from "@/components/wall/Lightbox";
import { WallHeading } from "@/components/wall/WallHeading";

/**
 * The wall: its heading ringed by the pieces' colours, then everything pinned to it, newest
 * first, with the sealed pieces (those still waiting for their date) at the head of the
 * wall. Pieces sit in a grid so the reading and tab order follow what you see, each tilted
 * and nudged by its own seed so it still looks pinned by hand.
 */
export function WallPage({ pieces, sealed = [] }: { pieces: PinnedPiece[]; sealed?: SealedPiece[] }) {
  const [open, setOpen] = useState<WallPiece | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const shown = pieces.length > 0 ? pieces : PLACEHOLDER_PIECES;

  return (
    <>
      <main className="relative z-(--z-content) min-h-screen" data-wall="">
        <div className="wall-grain pointer-events-none absolute inset-0 opacity-20" aria-hidden="true" />
        {/* Clears the floating dock */}
        <div className="h-20" aria-hidden="true" />
        <h1 className="sr-only">the wall</h1>
        <WallHeading pieces={shown} />

        <ul className="relative mx-auto grid max-w-6xl grid-cols-2 justify-items-center gap-x-4 gap-y-14 px-4 pt-6 pb-36 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4 xl:grid-cols-5">
          {sealed.map((seal) => (
            <li key={seal.id}>
              <SealedPolaroid seal={seal} />
            </li>
          ))}
          {shown.map((piece) => (
            <li key={piece.id}>
              <Polaroid piece={piece} onOpen={setOpen} />
            </li>
          ))}
        </ul>
      </main>

      <Lightbox piece={open} onClose={() => setOpen(null)} />
    </>
  );
}

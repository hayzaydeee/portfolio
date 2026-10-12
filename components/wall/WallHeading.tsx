"use client";

import { useMemo } from "react";
import { FxStage } from "@/components/fx/FxStage";
import type { PinnedPiece } from "@/lib/wall/placeholders";
import { usePieceColours } from "./usePieceColours";

/**
 * The wall's heading (`effects/gallery-ring`): "the wall" ringed by twelve plates in the
 * colours of the pieces pinned to it, turning while the pointer is over it. Decorative; the
 * page's own h1 names the room.
 */
export function WallHeading({ pieces }: { pieces: PinnedPiece[] }) {
  const colours = usePieceColours(pieces);
  const setup = useMemo(() => (colours.length ? { plates: colours } : undefined), [colours]);
  return (
    <div className="relative h-[clamp(300px,min(60vh,92vw),600px)] w-full" aria-hidden="true" data-wall-heading="">
      <FxStage slot="wall.heading" setup={setup} className="absolute inset-0" posterClassName="bg-transparent" />
    </div>
  );
}

"use client";

import { FxStage } from "@/components/fx/FxStage";

/**
 * The wall's backdrop: afternoon light through a window, and the dust in it. Mounted in the
 * room layout, fixed under the page, so the pieces scroll over a room that stays put.
 */
export function WallBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-(--z-backdrop)" aria-hidden="true" data-wall-backdrop="">
      <FxStage slot="wall.backdrop" className="absolute inset-0" posterClassName="bg-transparent" />
    </div>
  );
}

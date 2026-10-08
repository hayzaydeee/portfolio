"use client";

import { FxStage } from "@/components/fx/FxStage";
import { useClaimStudioPlayer } from "@/lib/audio/studioPlayer";

/**
 * The studio's backdrop: the bell field in burgundy, mounted in the room layout so it keeps
 * ringing between the tracks view and an essay. While music plays, its strikes follow the
 * kick onsets; silent, it strikes on its own timer. Mounted for as long as the room is, it
 * also claims the player bar's studio key.
 */
export function StudioBackdrop() {
  useClaimStudioPlayer();
  return (
    <div className="pointer-events-none fixed inset-0 z-(--z-backdrop)" aria-hidden="true" data-studio-backdrop="">
      <FxStage slot="studio.backdrop" className="absolute inset-0" posterClassName="bg-(--studio-base)" />
    </div>
  );
}

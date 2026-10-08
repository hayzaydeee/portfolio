"use client";

import { FxStage } from "@/components/fx/FxStage";

/**
 * The workshop's editor backdrop: a breathing dot matrix behind the whole IDE, mounted in the
 * room layout so it survives moving between /work and a project. Panels sit over it with a
 * little transparency, so the grid reads through the editor without competing with text.
 */
export function WorkshopBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 z-(--z-backdrop)" aria-hidden="true" data-workshop-backdrop="">
      <FxStage slot="workshop.backdrop" className="absolute inset-0" posterClassName="bg-(--workshop-base)" />
    </div>
  );
}

"use client";

import { useRef } from "react";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";

/**
 * The desk's banner: the six journals' names woven into a sheet of letters hung from six
 * pegs (`effects/cloth-study`). Decorative, so hidden from assistive tech; the canvas takes no
 * input, so this layer hands a grab, its pull and the let-go to the effect in stage pixels.
 */
export function ClothHeading() {
  const fx = useRef<FxHandle>(null);

  const at = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const drop = () => fx.current?.command("drop");

  return (
    <div className="relative h-44 w-full md:h-56" aria-hidden="true" data-cloth-heading="">
      <FxStage slot="notebook.cloth" handle={fx} className="absolute inset-0" posterClassName="bg-transparent" />
      <div
        className="cloth-surface absolute inset-0"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          fx.current?.command("grab", at(e));
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) fx.current?.command("pull", at(e));
        }}
        onPointerUp={drop}
        onPointerCancel={drop}
        onLostPointerCapture={drop}
      />
    </div>
  );
}

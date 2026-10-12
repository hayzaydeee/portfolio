"use client";

import { useMemo } from "react";
import { FxStage } from "@/components/fx/FxStage";
import type { SealedPiece } from "@/lib/data/wall";
import { formatUnseals } from "@/lib/wall/format";
import { FRAME, Pin, TypeBadge, scatterVars } from "./Polaroid";

/**
 * A piece pinned face down until its date: an ember seal (`effects/ember-seal`) burning on
 * undeveloped film, and when it opens. The seal's data carries no media or caption, so there's
 * nothing under it to leak.
 */
export function SealedPolaroid({ seal }: { seal: SealedPiece }) {
  const options = useMemo(() => ({ seed: seal.id }), [seal.id]);
  const date = formatUnseals(seal.publish_at);
  return (
    <div className="relative rotate-(--r) translate-x-(--sx) translate-y-(--sy)" style={scatterVars(seal.id)}>
      <figure className={FRAME} data-sealed={seal.id}>
        <Pin />
        <span className="relative block aspect-square overflow-hidden rounded-sm bg-(--wall-caption)">
          <FxStage slot="wall.seal" options={options} className="absolute inset-0" posterClassName="bg-(--wall-caption)" />
          <TypeBadge type={seal.type} />
        </span>
        <figcaption className="block px-1 pt-2">
          <span className="block font-script text-xs leading-tight text-(--wall-caption)">sealed</span>
          <span className="mt-0.5 block font-mono text-[9px] text-(--wall-date)">unseals {date}</span>
        </figcaption>
      </figure>
    </div>
  );
}

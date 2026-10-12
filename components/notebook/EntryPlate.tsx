"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { FxStage } from "@/components/fx/FxStage";
import { useFxGlobals } from "@/components/fx/FxConfig";
import type { Journal } from "@/lib/notebook/journals";

const SLOT = { engraved: "notebook.plate.engraved", drift: "notebook.plate.drift" } as const;

/**
 * The plate behind an entry's header, chosen per journal in the lab: an engraved plate whose
 * medallion is the entry's own (seeded by its slug), or a drift of the entry's own letters (code
 * glyphs in the build log). The header's text is the page's, on top.
 */
export function EntryPlate({ journal, slug, glyphs, children }: { journal: Journal; slug: string; glyphs: string; children: React.ReactNode }) {
  const style = useFxGlobals().plates[journal];
  const slot = style === "none" ? null : SLOT[style];
  const options = useMemo(
    () =>
      style === "engraved"
        ? { seed: slug, ink: `notebook-${journal}` }
        : { glyphs, ink: `notebook-${journal}`, face: journal === "buildlog" ? "mono" : "serif" },
    [style, slug, journal, glyphs]
  );

  return (
    <div
      data-entry-plate={style}
      className={cn(
        "relative isolate mb-10",
        slot && "flex min-h-40 flex-col justify-center overflow-hidden rounded-sm border border-(--notebook-border) px-6 py-9 sm:px-9"
      )}
    >
      {slot && <FxStage slot={slot} options={options} className="absolute inset-0 -z-10" posterClassName="bg-(--notebook-surface)" />}
      {children}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { FxStage } from "@/components/fx/FxStage";
import { JOURNAL_MOTIFS } from "@/components/fx/effects/journal-motifs";
import { journalInfo, type Journal } from "@/lib/notebook/journals";

/**
 * A journal's noren (`effects/woven-cloth`): dyed in its colour, its mark as the crest, its
 * name across the panels and its numeral on the seal. Decorative; the page's own heading
 * carries the name for everyone else.
 */
export function Noren({ journal }: { journal: Journal }) {
  const options = useMemo(() => {
    const info = journalInfo(journal);
    return { title: info.label, numeral: info.roman, motif: JOURNAL_MOTIFS[journal], dye: `notebook-${journal}` };
  }, [journal]);

  return (
    // The cloth fills a stage about 1.7 times as wide as it is tall; on a narrow screen the stage
    // stops at that shape instead of leaving empty shoji above and below it
    <div className="noren-stage relative h-[clamp(200px,min(46vh,64vw),440px)] w-full" aria-hidden="true">
      <FxStage slot="notebook.noren" options={options} className="absolute inset-0" posterClassName="bg-(--notebook-surface)" />
    </div>
  );
}

"use client";

import Link from "next/link";
import type { AnalysisEssay } from "@/app/actions/studio";
import { Decode } from "@/components/fx/ui/Decode";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** The essays, newest first; each title decodes into place as the list comes into view */
export function AnalysisMode({ essays }: { essays: AnalysisEssay[] }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h2 className="mb-8 font-mono text-xs tracking-widest text-(--studio-text-muted) uppercase">analysis</h2>

      {essays.length === 0 ? (
        <p className="text-sm text-(--studio-text-muted) italic">No essays published yet.</p>
      ) : (
        <ul className="divide-y divide-(--studio-border)" data-essay-list="">
          {essays.map((essay, i) => (
            <li key={essay.id}>
              <Link href={`/music/analysis/${essay.slug}`} className="group block py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Decode
                      as="h3"
                      text={essay.title}
                      trigger="visible"
                      delay={i * 120}
                      className="mb-1 text-base font-medium text-(--studio-text) transition-colors duration-150 group-hover:text-(--studio-accent-light) group-focus-visible:text-(--studio-accent-light)"
                    />
                    <p className="text-sm text-(--studio-text-muted)">{essay.subject}</p>
                  </div>
                  <div className="shrink-0 space-y-1 text-right font-mono text-xs text-(--studio-text-muted)">
                    <div>{formatDate(essay.created_at)}</div>
                    {essay.read_time_minutes && <div>{essay.read_time_minutes} min read</div>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

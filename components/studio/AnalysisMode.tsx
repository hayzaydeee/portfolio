"use client";

import Link from "next/link";
import type { AnalysisEssay } from "@/app/actions/studio";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function AnalysisMode({ essays }: { essays: AnalysisEssay[] }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h2
        className="text-xs font-mono uppercase tracking-widest mb-8"
        style={{ color: "var(--studio-text-muted)" }}
      >
        analysis
      </h2>

      {essays.length === 0 ? (
        <p className="text-sm italic" style={{ color: "var(--studio-text-muted)" }}>
          No essays published yet.
        </p>
      ) : (
        <div className="space-y-0">
          {essays.map((essay, i) => (
            <Link
              key={essay.id}
              href={`/music/analysis/${essay.slug}`}
              className="block group"
            >
              <div
                className="py-5 transition-colors duration-150"
                style={{
                  borderBottom: i < essays.length - 1 ? "1px solid var(--studio-border)" : "none",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3
                      className="text-base font-medium mb-1 group-hover:text-(--studio-accent-light) transition-colors duration-150" 
                      style={{ color: "var(--studio-text)" }}
                    >
                      {essay.title}
                    </h3>
                    <p className="text-sm" style={{ color: "var(--studio-text-muted)" }}>
                      {essay.subject}
                    </p>
                  </div>
                  <div
                    className="shrink-0 text-right text-xs font-mono space-y-1"
                    style={{ color: "var(--studio-text-muted)" }}
                  >
                    <div>{formatDate(essay.created_at)}</div>
                    {essay.read_time_minutes && (
                      <div>{essay.read_time_minutes} min read</div>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

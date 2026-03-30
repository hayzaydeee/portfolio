"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { Journal, NotebookEntry } from "@/lib/data/notebook";

const JOURNAL_COLOR: Record<Journal, string> = {
  reflections: "var(--notebook-reflections)",
  fragments:   "var(--notebook-fragments)",
  annotations: "var(--notebook-annotations)",
  responses:   "var(--notebook-responses)",
  buildlog:    "var(--notebook-buildlog)",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function EntryRow({
  entry,
  journal,
  index,
}: {
  entry: NotebookEntry;
  journal: Journal;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        href={`/notebook/${journal}/${entry.slug}`}
        className="group block py-5 border-b transition-colors duration-150"
        style={{ borderColor: "var(--notebook-border)" }}
      >
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex-1 min-w-0">
            {entry.title ? (
              <p
                className="text-base font-serif transition-colors duration-150"
                style={{
                  color: "var(--notebook-text)",
                }}
              >
                <span
                  className="group-hover:underline"
                  style={{ textDecorationColor: JOURNAL_COLOR[journal] }}
                >
                  {entry.title}
                </span>
              </p>
            ) : (
              <p
                className="text-base font-serif italic truncate transition-colors duration-150"
                style={{ color: "var(--notebook-text-muted)" }}
              >
                {entry.body_html
                  ? entry.body_html.replace(/<[^>]+>/g, "").slice(0, 80) + "…"
                  : "Untitled entry"}
              </p>
            )}

            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-mono" style={{ color: "var(--notebook-text-muted)" }}>
                {formatDate(entry.published_at ?? entry.created_at)}
              </span>
              {entry.read_time_minutes != null && (
                <>
                  <span style={{ color: "var(--notebook-border)" }}>·</span>
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--notebook-text-muted)" }}
                  >
                    {entry.read_time_minutes < 1
                      ? "< 1 min"
                      : `${entry.read_time_minutes} min`}
                  </span>
                </>
              )}
            </div>
          </div>

          <span
            className="text-sm shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            style={{ color: JOURNAL_COLOR[journal] }}
          >
            →
          </span>
        </div>

        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm"
                style={{
                  background: "rgba(28,26,22,0.06)",
                  color: "var(--notebook-text-muted)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Link>
    </motion.div>
  );
}

type Props = {
  journal: Journal;
  label: string;
  description: string;
  entries: NotebookEntry[];
};

export function JournalList({ journal, label, description, entries }: Props) {
  const color = JOURNAL_COLOR[journal];

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--notebook-surface)", color: "var(--notebook-text)" }}
    >
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-12">
          <Link
            href="/notebook"
            className="text-xs font-mono transition-colors duration-150"
            style={{ color: "var(--notebook-text-muted)" }}
          >
            ← back to desk
          </Link>
        </div>

        {/* Journal header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ background: color }}
            />
            <h1 className="text-xl font-serif" style={{ color: "var(--notebook-text)" }}>
              {label}
            </h1>
          </div>
          <p className="text-sm ml-6" style={{ color: "var(--notebook-text-muted)" }}>
            {description}
          </p>
        </div>

        {/* Entry list */}
        {entries.length === 0 ? (
          <p
            className="text-sm font-mono py-8 text-center"
            style={{ color: "var(--notebook-text-muted)" }}
          >
            Nothing here yet.
          </p>
        ) : (
          <div>
            {entries.map((entry, i) => (
              <EntryRow key={entry.id} entry={entry} journal={journal} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

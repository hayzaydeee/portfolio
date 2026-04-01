"use client";

import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";
import type { Journal, NotebookEntry } from "@/lib/data/notebook";
import { PageCurl } from "@/components/notebook/PageCurl";

const JOURNAL_COLOR: Record<Journal, string> = {
  reflections: "var(--notebook-reflections)",
  fragments:   "var(--notebook-fragments)",
  annotations: "var(--notebook-annotations)",
  responses:   "var(--notebook-responses)",
  buildlog:    "var(--notebook-buildlog)",
  cookbook:    "var(--notebook-cookbook)",
};

const JOURNAL_LABEL: Record<Journal, string> = {
  reflections: "Reflections",
  fragments:   "Fragments",
  annotations: "Annotations",
  responses:   "Responses",
  buildlog:    "Build log",
  cookbook:    "Cookbook",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type Props = {
  entry: NotebookEntry;
  journal: Journal;
  prevSlug: string | null;
  nextSlug: string | null;
};

export function EntryPage({ entry, journal, prevSlug, nextSlug }: Props) {
  const color = JOURNAL_COLOR[journal];
  const safeHtml = DOMPurify.sanitize(entry.body_html ?? "");

  // Class variant for prose styles
  const proseVariant =
    journal === "buildlog"
      ? "prose-notebook prose-notebook--buildlog"
      : journal === "fragments"
      ? "prose-notebook prose-notebook--fragments"
      : journal === "cookbook"
      ? "prose-notebook prose-notebook--cookbook"
      : "prose-notebook";

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--notebook-surface)", color: "var(--notebook-text)" }}
    >
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Nav row */}
        <div className="flex items-center justify-between mb-10">
          <Link
            href={`/notebook/${journal}`}
            className="text-xs font-mono transition-colors duration-150"
            style={{ color: "var(--notebook-text-muted)" }}
          >
            ← {JOURNAL_LABEL[journal]}
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
            <span className="text-xs font-mono" style={{ color: "var(--notebook-text-muted)" }}>
              {JOURNAL_LABEL[journal]}
            </span>
          </div>
        </div>

        {/* Entry header */}
        <header className="mb-8">
          {/* Date — handwritten-style font */}
          <p
            className="font-script text-sm mb-3"
            style={{ color: "var(--notebook-text-muted)" }}
          >
            {formatDate(entry.published_at ?? entry.created_at)}
            {entry.read_time_minutes != null && (
              <span className="font-mono text-xs ml-3">
                {entry.read_time_minutes < 1
                  ? "< 1 min"
                  : `${entry.read_time_minutes} min read`}
              </span>
            )}
          </p>

          {entry.title && (
            <h1
              className="font-serif text-2xl leading-snug"
              style={{ color: "var(--notebook-text)" }}
            >
              {entry.title}
            </h1>
          )}

          {/* Divider */}
          <div
            className="mt-6 h-px"
            style={{ background: "var(--notebook-border)" }}
          />
        </header>

        {/* Entry body */}
        <article
          className={proseVariant}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />

        {/* Tags */}
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-12 pt-6 border-t" style={{ borderColor: "var(--notebook-border)" }}>
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-mono px-2 py-0.5 rounded-sm"
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
      </div>

      {/* Page curl navigation */}
      <PageCurl
        journal={journal}
        prevSlug={prevSlug}
        nextSlug={nextSlug}
      />
    </div>
  );
}

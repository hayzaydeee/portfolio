import type { AnalysisEssay } from "@/app/actions/studio";
import DOMPurify from "isomorphic-dompurify";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function EssayView({ essay }: { essay: AnalysisEssay }) {
  const safeHtml = essay.body_html ? DOMPurify.sanitize(essay.body_html) : "";

  return (
    <article className="max-w-2xl mx-auto px-6 py-12">
      <a
        href="/music"
        className="text-xs font-mono mb-8 inline-block transition-colors duration-150"
        style={{ color: "var(--studio-text-muted)" }}
      >
        ← back to studio
      </a>

      {/* Header */}
      <div className="mb-8">
        <p
          className="text-sm mb-2 font-serif italic"
          style={{ color: "var(--studio-text-muted)" }}
        >
          {essay.subject}
        </p>
        <h1
          className="text-3xl font-serif font-semibold leading-tight mb-3"
          style={{ color: "var(--studio-text)" }}
        >
          {essay.title}
        </h1>
        <div
          className="flex gap-4 text-xs font-mono"
          style={{ color: "var(--studio-text-muted)" }}
        >
          <span>{formatDate(essay.created_at)}</span>
          {essay.read_time_minutes && <span>{essay.read_time_minutes} min read</span>}
        </div>
      </div>

      {/* Divider */}
      <div
        className="mb-8"
        style={{ borderTop: "1px solid var(--studio-border)" }}
      />

      {/* Essay body */}
      {safeHtml ? (
        <div
          className="prose-essay"
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      ) : (
        <p className="text-sm italic" style={{ color: "var(--studio-text-muted)" }}>
          No content yet.
        </p>
      )}
    </article>
  );
}

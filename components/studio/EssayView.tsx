import Link from "next/link";
import type { AnalysisEssay } from "@/app/actions/studio";
import DOMPurify from "isomorphic-dompurify";
import { FxStage } from "@/components/fx/FxStage";
import { Decode } from "@/components/fx/ui/Decode";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * One essay. Its header sits on a faint band of converging light and its title decodes in;
 * the body stays plain prose. The way back is a client link, so whatever is playing keeps
 * playing.
 */
export function EssayView({ essay }: { essay: AnalysisEssay }) {
  const safeHtml = essay.body_html ? DOMPurify.sanitize(essay.body_html) : "";

  return (
    <article className="mx-auto max-w-2xl px-6 py-12" data-essay={essay.slug}>
      <Link
        href="/music"
        className="mb-8 inline-block font-mono text-xs text-(--studio-text-muted) transition-colors duration-150 hover:text-(--studio-text) focus-visible:text-(--studio-text)"
      >
        ← back to studio
      </Link>

      {/* isolate: the band's negative z stays inside the header, above the room's backdrop */}
      <header className="relative isolate mb-8">
        <div className="pointer-events-none absolute -inset-x-6 -inset-y-16 -z-10" aria-hidden="true" data-essay-stream="">
          <FxStage effect="stream-convergence" room="studio" className="size-full" posterClassName="bg-transparent" />
        </div>
        <p className="mb-2 font-serif text-sm text-(--studio-text-muted) italic">{essay.subject}</p>
        <Decode as="h1" text={essay.title} className="mb-3 font-serif text-3xl leading-tight font-semibold text-(--studio-text)" />
        <div className="flex gap-4 font-mono text-xs text-(--studio-text-muted)">
          <span>{formatDate(essay.created_at)}</span>
          {essay.read_time_minutes && <span>{essay.read_time_minutes} min read</span>}
        </div>
      </header>

      <hr className="mb-8 border-(--studio-border)" />

      {safeHtml ? (
        <div className="prose-essay" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      ) : (
        <p className="text-sm text-(--studio-text-muted) italic">No content yet.</p>
      )}
    </article>
  );
}

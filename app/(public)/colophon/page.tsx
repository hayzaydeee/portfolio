import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "colophon — hayzaydee",
  description: "how this site was made and what made it hard.",
};

export default function ColophonPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-20">
      <header className="mb-12">
        <h1 className="text-2xl font-mono font-semibold tracking-tight text-text mb-2">
          colophon
        </h1>
        <p className="text-sm text-text-muted font-mono">
          // how this place was made
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed text-text-muted">
        <section>
          <p>
            built with Next.js App Router, Supabase, Tailwind v4, and Framer
            Motion. deployed on Vercel. the type is Geist — Vercel's open
            font — because it reads well at small sizes and doesn't try to say
            too much.
          </p>
        </section>

        <section>
          <p>
            the site has five rooms. the lobby is where most people land. the
            workshop is a fake IDE — a format that felt honest for code work.
            the studio is for music. the notebook publishes from bito.works
            via webhook. the wall is for things that don't fit anywhere else.
          </p>
        </section>

        <section>
          <p>
            the AI terminal in the workshop is claude-based. it has a narrow
            context window, a hard query limit, and rate limiting — less to
            control cost (the usage is low) and more to keep the interaction
            intentional. you're not meant to have a conversation with it.
            ask one thing, get one answer, maybe follow one thread.
          </p>
        </section>

        <section>
          <p>
            what was hard: not over-building. the first version had
            authentication flows for anonymous visitors, a full music player
            with visualisers, and a notebook with page-curl transitions. most
            of that got stripped back to what was actually necessary. the
            hardest design decision was the wall — it's the loosest room and
            the most genuinely personal, which made it the most difficult to
            commit to.
          </p>
        </section>

        <section>
          <p>
            the life.log file in the workshop is real. it's not clever
            branding.
          </p>
        </section>
      </div>

      <footer className="mt-16 pt-8 border-t border-black/8">
        <p className="text-xs text-text-muted font-mono">
          last updated: 2025 —{" "}
          <a
            href="/"
            className="underline underline-offset-2 hover:text-text transition-colors"
          >
            back to lobby
          </a>
        </p>
      </footer>
    </div>
  );
}

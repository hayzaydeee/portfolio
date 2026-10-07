"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileTree } from "@/components/workshop/FileTree";
import { TabBar, useTabState } from "@/components/workshop/TabBar";
import { ActivityFeed } from "@/components/workshop/ActivityFeed";
import { StatusBar } from "@/components/workshop/StatusBar";
import { AskTerminal } from "@/components/workshop/AskTerminal";
import type { WorkshopProject } from "@/components/workshop/FileTree";
import type { Currently } from "@/lib/data/currently";
import { FxStage } from "@/components/fx/FxStage";
import { Decode, DECODE_MONO_POOL } from "@/components/fx/ui/Decode";
import { WorkshopBoot, useWorkshopBoot } from "@/components/workshop/WorkshopBoot";

// ─── Static file content ──────────────────────────────────────────────────────

const README_CONTENT = `# hayzaydee

software engineer. second year at northampton.
building things in javascript mostly, branching out constantly.

currently working on vrrbose, a developer activity daemon with
an MCP gateway. it's the most technically interesting thing i've
built so far.

if something here is useful to you, good.
if you want to talk, the lobby has a form.`;

const STACK_CONTENT = `{
  "languages": {
    "javascript": "daily driver",
    "typescript": "when the project deserves it",
    "kotlin": "android work, university",
    "cpp": "university, respect the language"
  },
  "frontend": ["react", "next.js", "framer motion"],
  "backend": ["node.js", "express", "mongodb"],
  "tools": ["git", "vercel", "figma", "vscode"]
  // yes this file has comments. yes i know.
}`;

const LIFE_LOG_CONTENT = `[WARN]  purpose.exe is running but output is unclear
[INFO]  trust_process() called, awaiting resolution
[ERROR] comparison.js: cannot benchmark self against others
        stack trace: identity not found in external validation
[INFO]  faith.config loaded successfully
[DEBUG] patience: still compiling
[WARN]  growth is slow but process confirms it is running
[INFO]  still growing.`;

// Each line decodes in on its own beat; continuation lines keep their indent
const LIFE_LOG_LINES = LIFE_LOG_CONTENT.split("\n");

// ─── File content renderer ────────────────────────────────────────────────────

function FileContent({ slug, highlightedStackHtml }: { slug: string | null; highlightedStackHtml?: string | null }) {
  if (!slug) return null;

  if (slug === "readme") {
    return (
      <div className="p-6 overflow-auto h-full flex flex-col gap-6">
        <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-(--workshop-text)">
          {README_CONTENT}
        </pre>
        <AskTerminal
          defaultQuery="what are you most focused on right now?"
          variant="workshop"
        />
      </div>
    );
  }

  if (slug === "stack") {
    if (highlightedStackHtml) {
      return (
        <div
          className="text-sm overflow-auto h-full"          dangerouslySetInnerHTML={{ __html: highlightedStackHtml }}
        />
      );
    }
    return (
      <pre
        className="p-6 font-mono text-sm leading-relaxed overflow-auto h-full whitespace-pre-wrap text-(--workshop-text-muted)"
      >
        {STACK_CONTENT}
      </pre>
    );
  }

  if (slug === "life-log") {
    return (
      <div className="relative h-full overflow-hidden" data-life-log="">
        {/* Breath on the glass: the log reads through condensation */}
        <FxStage slot="workshop.lifelog" className="absolute inset-0" posterClassName="bg-transparent" />
        <div className="relative flex h-full flex-col gap-6 overflow-auto p-6">
          <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap text-(--workshop-syntax-dim)">
            {LIFE_LOG_LINES.map((line, i) => (
              <span key={i} className="block">
                <Decode text={line} delay={i * 220} duration={520} pool={DECODE_MONO_POOL} />
              </span>
            ))}
          </pre>
          <AskTerminal defaultQuery="what does this log mean?" variant="life-log" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex items-center justify-center p-6 font-mono text-xs text-(--workshop-text-muted)"
    >
      {"// select a file to view"}
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

type WorkshopClientProps = {
  projects: WorkshopProject[];
  currently: Currently | null;
  highlightedStackHtml?: string | null;
};

const FILE_SLUGS = new Set(["readme", "stack", "life-log"]);

export function WorkshopClient({ projects, currently, highlightedStackHtml }: WorkshopClientProps) {
  const router = useRouter();
  const { openTabs, activeSlug, openTab, closeTab } = useTabState("readme");
  const [mobilePanel, setMobilePanel] = useState<"tree" | "content">("content");
  const boot = useWorkshopBoot();

  const projectSlugs = new Set(projects.map((p) => p.slug));

  function handleSelect(slug: string) {
    if (projectSlugs.has(slug)) {
      // Project dirs navigate to the project detail page
      router.push(`/work/${slug}`);
    } else if (FILE_SLUGS.has(slug)) {
      openTab(slug);
    }
  }

  return (
    <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
      <h1 className="sr-only">workshop</h1>
      {boot.booting && <WorkshopBoot projects={projects.length} onFinished={boot.finish} />}

      {/* Mobile tab selector */}
      <div
        className="md:hidden flex gap-0 border-b shrink-0 border-(--workshop-tree-border)"
      >
        {(["tree", "content"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMobilePanel(p)}
            className={`flex-1 py-2 text-xs font-mono transition-colors ${
              mobilePanel === p
                ? "text-(--workshop-text) bg-(--workshop-tab) border-b-2 border-(--workshop-syntax)"
                : "text-(--workshop-text-muted)"
            }`}
          >
            {p === "tree" ? "explorer" : "editor"}
          </button>
        ))}
      </div>

      {/* Main 3-panel body */}
      <div className="flex flex-1 overflow-hidden">
        {/* File tree panel */}
        <aside
          className={[
            "w-60 border-r border-(--workshop-tree-border) overflow-hidden shrink-0",
            "hidden md:flex md:flex-col",
            mobilePanel === "tree" ? "flex flex-col w-full md:w-60" : "",
          ].join(" ")}
        >
          <FileTree activeSlug={activeSlug} onSelect={handleSelect} projects={projects} />
        </aside>

        {/* Content panel */}
        <div
          className={[
            "flex-1 flex flex-col overflow-hidden bg-(--workshop-panel)/80",
            mobilePanel === "content" ? "flex" : "hidden md:flex",
          ].join(" ")}
        >
          {openTabs.length > 0 && (
            <TabBar
              openTabs={openTabs}
              activeSlug={activeSlug}
              onSelect={openTab}
              onClose={closeTab}
            />
          )}

          <div className="flex-1 overflow-hidden flex flex-col">
            {activeSlug ? (
              <FileContent slug={activeSlug} highlightedStackHtml={highlightedStackHtml} />
            ) : (
              <ActivityFeed currently={currently} />
            )}
          </div>
        </div>
      </div>

      <StatusBar activeSlug={activeSlug} />
    </div>
  );
}

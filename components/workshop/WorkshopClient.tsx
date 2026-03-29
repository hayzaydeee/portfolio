"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileTree } from "@/components/workshop/FileTree";
import { TabBar, useTabState } from "@/components/workshop/TabBar";
import { ActivityFeed } from "@/components/workshop/ActivityFeed";
import { StatusBar } from "@/components/workshop/StatusBar";
import { HzyMark } from "@/components/nav/HzyMark";
import type { WorkshopProject } from "@/components/workshop/FileTree";
import type { Currently } from "@/lib/data/currently";

// ─── Static file content ──────────────────────────────────────────────────────

const README_CONTENT = `# hayzaydee

software engineer. second year at northampton.
building things in javascript mostly, branching out constantly.

currently working on vrrbose — a developer activity daemon with
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
[INFO]  trust_process() called — awaiting resolution
[ERROR] comparison.js: cannot benchmark self against others
        stack trace: identity not found in external validation
[INFO]  faith.config loaded successfully
[DEBUG] patience: still compiling
[WARN]  growth is slow but process confirms it is running
[INFO]  still growing.`;

// ─── File content renderer ────────────────────────────────────────────────────

function FileContent({ slug }: { slug: string | null }) {
  if (!slug) return null;

  if (slug === "readme") {
    return (
      <pre
        className="p-6 font-mono text-sm leading-relaxed overflow-auto h-full whitespace-pre-wrap"
        style={{ color: "var(--workshop-text)" }}
      >
        {README_CONTENT}
      </pre>
    );
  }

  if (slug === "stack") {
    return (
      <pre
        className="p-6 font-mono text-sm leading-relaxed overflow-auto h-full whitespace-pre-wrap"
        style={{ color: "var(--workshop-text-muted)" }}
      >
        {STACK_CONTENT}
      </pre>
    );
  }

  if (slug === "life-log") {
    return (
      <pre
        className="p-6 font-mono text-sm leading-relaxed overflow-auto h-full whitespace-pre-wrap"
        style={{ color: "var(--workshop-syntax-dim)" }}
      >
        {LIFE_LOG_CONTENT}
      </pre>
    );
  }

  return (
    <div
      className="flex-1 flex items-center justify-center p-6 font-mono text-xs"
      style={{ color: "var(--workshop-text-muted)" }}
    >
      // select a file to view
    </div>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

type WorkshopClientProps = {
  projects: WorkshopProject[];
  currently: Currently | null;
};

const FILE_SLUGS = new Set(["readme", "stack", "life-log"]);

export function WorkshopClient({ projects, currently }: WorkshopClientProps) {
  const router = useRouter();
  const { openTabs, activeSlug, openTab, closeTab } = useTabState("readme");
  const [mobilePanel, setMobilePanel] = useState<"tree" | "content">("content");

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
    <div className="flex flex-col h-screen overflow-hidden">
      {/* IDE top bar */}
      <header
        className="flex items-center justify-between px-4 py-2 border-b shrink-0"
        style={{
          background: "var(--workshop-panel)",
          borderColor: "var(--workshop-tree-border)",
        }}
      >
        <Link href="/" aria-label="back to lobby" className="flex items-center gap-2">
          <HzyMark mode="dark" size={20} />
          <span className="font-mono text-xs" style={{ color: "var(--workshop-text-muted)" }}>
            ~/workshop
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          {(["work", "music", "notebook", "wall"] as const).map((r) => (
            <Link
              key={r}
              href={r === "work" ? "/work" : `/${r}`}
              className="font-mono text-xs transition-colors"
              style={{ color: "var(--workshop-text-muted)" }}
            >
              {r}
            </Link>
          ))}
        </nav>
      </header>

      {/* Mobile tab selector */}
      <div
        className="md:hidden flex gap-0 border-b shrink-0"
        style={{ borderColor: "var(--workshop-tree-border)" }}
      >
        {(["tree", "content"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMobilePanel(p)}
            className="flex-1 py-2 text-xs font-mono transition-colors"
            style={{
              color: mobilePanel === p ? "var(--workshop-text)" : "var(--workshop-text-muted)",
              background: mobilePanel === p ? "var(--workshop-tab)" : "transparent",
              borderBottom: mobilePanel === p ? "2px solid var(--workshop-syntax)" : "none",
            }}
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
            "w-60 border-r overflow-hidden shrink-0",
            "hidden md:flex md:flex-col",
            mobilePanel === "tree" ? "flex flex-col w-full md:w-60" : "",
          ].join(" ")}
          style={{ borderColor: "var(--workshop-tree-border)" }}
        >
          <FileTree activeSlug={activeSlug} onSelect={handleSelect} projects={projects} />
        </aside>

        {/* Content panel */}
        <div
          className={[
            "flex-1 flex flex-col overflow-hidden",
            mobilePanel === "content" ? "flex" : "hidden md:flex",
          ].join(" ")}
          style={{ background: "var(--workshop-panel)" }}
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
              <FileContent slug={activeSlug} />
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

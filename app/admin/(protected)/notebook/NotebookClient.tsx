"use client";

import { useState } from "react";
import { WriteTab, StagingTab } from "@/components/admin/notebook/NotebookTabs";
import type { NotebookEntry } from "@/app/actions/notebook";
import Link from "next/link";

type NotebookClientProps = {
  entries: NotebookEntry[];
  staged: NotebookEntry[];
};

export function NotebookClient({ entries, staged }: NotebookClientProps) {
  const [tab, setTab] = useState<"write" | "staging">("write");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-sans text-(--lobby-text)">Notebook</h1>
          <p className="text-sm text-(--color-text-muted) mt-0.5">
            {entries.filter((e) => e.status === "published").length} published ·{" "}
            {staged.length} staged
          </p>
        </div>
        <Link
          href="/admin/notebook/new"
          className="text-sm px-4 py-2 border border-(--lobby-text)/20 rounded-lg text-(--lobby-text) hover:bg-white/5 transition-colors"
        >
          New entry
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        <button
          onClick={() => setTab("write")}
          className={[
            "px-4 py-2 text-sm font-sans transition-colors border-b-2 -mb-px",
            tab === "write"
              ? "border-(--lobby-text) text-(--lobby-text)"
              : "border-transparent text-(--color-text-muted) hover:text-(--lobby-text)",
          ].join(" ")}
        >
          Write
        </button>
        <button
          onClick={() => setTab("staging")}
          className={[
            "px-4 py-2 text-sm font-sans transition-colors border-b-2 -mb-px flex items-center gap-2",
            tab === "staging"
              ? "border-(--lobby-text) text-(--lobby-text)"
              : "border-transparent text-(--color-text-muted) hover:text-(--lobby-text)",
          ].join(" ")}
        >
          Staging
          {staged.length > 0 && (
            <span className="text-[10px] bg-[#B87A00]/20 text-[#B87A00] px-1.5 py-0.5 rounded-full">
              {staged.length}
            </span>
          )}
        </button>
      </div>

      {tab === "write" ? (
        <WriteTab entries={entries} />
      ) : (
        <StagingTab entries={staged} />
      )}
    </div>
  );
}

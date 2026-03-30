"use client";

import { useActionState } from "react";
import { approveEntry, rejectEntry } from "@/app/actions/notebook";
import type { NotebookEntry } from "@/app/actions/notebook";
import { StatusBadge } from "@/components/admin/StatusBadge";

type StagingRowProps = {
  entry: NotebookEntry;
};

function StagingRow({ entry }: StagingRowProps) {
  const [approveState, approveAction, approving] = useActionState(
    async () => approveEntry(entry.id),
    { success: false }
  );
  const [rejectState, rejectAction, rejecting] = useActionState(
    async () => rejectEntry(entry.id),
    { success: false }
  );

  const isDone = approveState.success || rejectState.success;
  if (isDone) return null;

  const preview = (entry.body_html ?? entry.content ?? "")
    .replace(/<[^>]+>/g, " ")
    .trim()
    .slice(0, 200);

  return (
    <div className="p-5 border-b border-black/6 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {entry.title && (
            <p className="text-sm font-medium text-(--color-base-dark) mb-1">{entry.title}</p>
          )}
          <p className="text-xs text-(--color-text-muted) leading-relaxed">{preview}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-(--color-text-muted)">
              {new Date(entry.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className="text-[10px] text-(--admin-status-scheduled) bg-(--admin-status-scheduled)/8 px-1.5 py-0.5 rounded">
              from bito.works
            </span>
            <select
              className="text-[10px] bg-transparent border border-black/10 rounded px-1. py-0.5 text-(--color-base-dark)"
              defaultValue={entry.journal}
            >
              <option value="reflections">reflections</option>
              <option value="fragments">fragments</option>
              <option value="annotations">annotations</option>
              <option value="responses">responses</option>
              <option value="buildlog">build log</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <form action={approveAction}>
            <button
              type="submit"
              disabled={approving}
              className="text-xs px-3 py-1.5 border border-accent/30 rounded text-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
            >
              {approving ? "…" : "Approve"}
            </button>
          </form>
          <form action={rejectAction}>
            <button
              type="submit"
              disabled={rejecting}
              className="text-xs px-3 py-1.5 border border-black/10 rounded text-(--color-text-muted) hover:border-black/25 transition-colors disabled:opacity-50"
            >
              {rejecting ? "…" : "Reject"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

type StagingTabProps = {
  entries: NotebookEntry[];
};

export function StagingTab({ entries }: StagingTabProps) {
  if (entries.length === 0) {
    return (
      <div className="bg-white border border-black/10 rounded-xl px-6 py-12 text-center">
        <p className="text-sm text-(--color-text-muted)">no entries pending review</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
      {entries.map((entry) => (
        <StagingRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

// ─── Entries list ─────────────────────────────────────────────────────────────

const JOURNAL_LABELS: Record<NotebookEntry["journal"], string> = {
  reflections: "Reflections",
  fragments: "Fragments",
  annotations: "Annotations",
  responses: "Responses",
  buildlog: "Build log",
};

type WriteTabProps = {
  entries: NotebookEntry[];
};

export function WriteTab({ entries }: WriteTabProps) {
  const grouped = entries.reduce<Record<string, NotebookEntry[]>>((acc, e) => {
    if (!acc[e.journal]) acc[e.journal] = [];
    acc[e.journal].push(e);
    return acc;
  }, {});

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-black/10 rounded-xl px-6 py-12 text-center">
        <p className="text-sm text-(--color-text-muted)">no entries yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(Object.keys(JOURNAL_LABELS) as NotebookEntry["journal"][])
        .filter((j) => grouped[j]?.length)
        .map((journal) => (
          <div key={journal} className="bg-white border border-black/10 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-black/6">
              <h3 className="text-xs font-medium text-(--color-base-dark)">
                {JOURNAL_LABELS[journal]}
              </h3>
            </div>
            {grouped[journal].map((entry) => (
              <a
                key={entry.id}
                href={`/admin/notebook/${entry.id}`}
                className="flex items-center justify-between px-5 py-3.5 border-b border-black/4 last:border-0 hover:bg-black/1.5 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-(--color-base-dark) group-hover:text-(--color-base-dark)">
                    {entry.title ?? <em className="text-(--color-text-muted)">untitled</em>}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-(--color-text-muted)">
                    {new Date(entry.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <StatusBadge status={entry.status as "published" | "draft" | "archived"} />
                </div>
              </a>
            ))}
          </div>
        ))}
    </div>
  );
}

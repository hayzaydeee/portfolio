"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createEntry, updateEntry, deleteEntry } from "@/app/actions/notebook";
import type { NotebookEntry, NotebookActionState } from "@/app/actions/notebook";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { TagInput } from "@/components/admin/TagInput";
import { useState } from "react";

const JOURNAL_OPTIONS: { value: NotebookEntry["journal"]; label: string; color: string }[] = [
  { value: "reflections",  label: "Reflections",  color: "accent" },
  { value: "fragments",    label: "Fragments",    color: "#7A4F1E" },
  { value: "annotations",  label: "Annotations",  color: "var(--admin-status-scheduled)" },
  { value: "responses",    label: "Responses",    color: "#6B1E6B" },
  { value: "buildlog",     label: "Build log",    color: "#2C2C28" },
  { value: "cookbook",     label: "Cookbook",     color: "#B85C38" },
];

type EntryFormProps = {
  entry?: NotebookEntry;
};

export function EntryForm({ entry }: EntryFormProps) {
  const router = useRouter();
  const isEdit = !!entry;

  const boundAction = entry
    ? updateEntry.bind(null, entry.id)
    : createEntry;

  const [state, action, pending] = useActionState<NotebookActionState, FormData>(
    boundAction,
    { success: false }
  );

  const [selectedJournal, setSelectedJournal] = useState<NotebookEntry["journal"]>(
    entry?.journal ?? "reflections"
  );
  const [showDelete, setShowDelete] = useState(false);

  if (state.success && state.id && !isEdit) {
    router.push(`/admin/notebook/${state.id}`);
  }

  async function handleDelete() {
    if (!entry) return;
    const result = await deleteEntry(entry.id);
    if (result.success) router.push("/admin/notebook");
  }

  return (
    <form action={action} className="space-y-6">
      {/* Journal type */}
      <section className="bg-white border border-black/10 rounded-xl p-5 space-y-3">
        <label className="block text-xs text-(--color-text-muted) mb-1">Journal</label>
        <div className="flex flex-wrap gap-2">
          {JOURNAL_OPTIONS.map(({ value, label, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedJournal(value)}
              className="px-3 py-1.5 rounded-full text-xs border transition-all"
              style={
                selectedJournal === value
                  ? { borderColor: color, backgroundColor: `${color}15`, color }
                  : { borderColor: "rgba(0,0,0,0.1)", color: "var(--color-text-muted)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="journal" value={selectedJournal} />
      </section>

      {/* Meta */}
      <section className="bg-white border border-black/10 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-xs text-(--color-text-muted) mb-1">Title (optional)</label>
          <input
            name="title"
            type="text"
            maxLength={200}
            defaultValue={entry?.title ?? ""}
            placeholder="untitled"
            className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-(--color-base-dark) focus:outline-none focus:border-accent/50"
          />
        </div>

        <div>
          <label className="block text-xs text-(--color-text-muted) mb-1.5">Tags (optional)</label>
          <TagInput
            name="tags"
            defaultTags={entry?.tags ?? []}
            placeholder="Add tag"
          />
        </div>
      </section>

      {/* Body */}
      <section className="bg-white border border-black/10 rounded-xl p-5 space-y-3">
        <label className="block text-xs text-(--color-text-muted)">Body</label>
        <RichTextEditor
          name="body_html"
          initialHtml={entry?.body_html ?? ""}
          placeholder="Start writing…"
          autosaveEntryId={entry?.id}
          minHeight="min-h-72"
        />
        {entry?.read_time_minutes && (
          <p className="text-[10px] text-(--color-text-muted)">
            {entry.read_time_minutes} min read
          </p>
        )}
      </section>

      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="submit"
            formAction={action}
            disabled={pending}
            onClick={(e) => {
              const form = e.currentTarget.closest("form") as HTMLFormElement;
              const input = form.querySelector<HTMLInputElement>('[name="status"]');
              if (input) input.value = "draft";
            }}
            className="text-sm px-4 py-2 border border-black/20 rounded-lg text-(--color-base-dark) hover:border-black/40 transition-colors disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="submit"
            disabled={pending}
            onClick={(e) => {
              const form = e.currentTarget.closest("form") as HTMLFormElement;
              const input = form.querySelector<HTMLInputElement>('[name="status"]');
              if (input) input.value = "published";
            }}
            className="text-sm px-4 py-2 border border-accent rounded-lg text-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
          >
            Publish
          </button>
          <input type="hidden" name="status" defaultValue="draft" />
        </div>

        {isEdit && (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="text-xs text-(--color-text-muted) hover:text-[#8B1F35] transition-colors"
          >
            Delete entry
          </button>
        )}
      </div>

      {state.error && <p className="text-sm text-[#8B1F35]">{state.error}</p>}

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-medium text-(--color-base-dark)">Delete entry</h3>
            <p className="text-xs text-(--color-text-muted)">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                className="flex-1 text-sm px-4 py-2 border border-black/20 rounded-lg text-(--color-base-dark)"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 text-sm px-4 py-2 bg-[#8B1F35] text-white rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}


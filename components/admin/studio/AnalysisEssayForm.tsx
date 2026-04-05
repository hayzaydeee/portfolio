"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import {
  createAnalysisEssay,
  updateAnalysisEssay,
  deleteAnalysisEssay,
} from "@/app/actions/studio";
import type { AnalysisEssay, StudioActionState } from "@/app/actions/studio";

type AnalysisEssayFormProps = {
  essay?: AnalysisEssay;
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
] as const;

export function AnalysisEssayForm({ essay }: AnalysisEssayFormProps) {
  const router = useRouter();
  const isEdit = !!essay;

  const boundAction = essay
    ? updateAnalysisEssay.bind(null, essay.id)
    : createAnalysisEssay;

  const [state, action, pending] = useActionState<StudioActionState, FormData>(
    boundAction,
    { success: false }
  );

  const [showDelete, setShowDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Controlled field state (persists through server action error re-renders)
  const [title, setTitle] = useState(essay?.title ?? "");
  const [slug, setSlug] = useState(essay?.slug ?? "");
  const [subject, setSubject] = useState(essay?.subject ?? "");
  const [status, setStatus] = useState(essay?.status ?? "draft");

  useEffect(() => {
    if (state.success && state.id && !isEdit) {
      router.push(`/admin/studio/essays/${state.id}`);
    }
  }, [state.success, state.id, isEdit, router]);

  async function handleDelete() {
    if (!essay) return;
    const result = await deleteAnalysisEssay(essay.id, deleteInput);
    if (result.success) {
      router.push("/admin/studio");
    } else {
      setDeleteError(result.error ?? "Delete failed");
    }
  }

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-8">
        {/* Identity */}
        <section className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-base-dark">Identity</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Title <span className="text-(--admin-accent-studio)">*</span>
              </label>
              <input
                name="title"
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Slug</label>
              <input
                name="slug"
                type="text"
                required
                maxLength={100}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="my-essay-slug"
                pattern="[a-z0-9-]+"
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 font-mono text-base-dark focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              Subject <span className="text-(--admin-accent-studio)">*</span>{" "}
              <span className="text-xs text-text-muted">(artist, album, or track)</span>
            </label>
            <input
              name="subject"
              type="text"
              required
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Kendrick Lamar — To Pimp a Butterfly"
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Status</label>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-48 text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50 bg-white"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Body */}
        <section className="bg-white border border-black/10 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-medium text-base-dark">Body</h2>
          <RichTextEditor
            name="body_html"
            initialHtml={essay?.body_html ?? ""}
            placeholder="Write your analysis here…"
          />
        </section>

        {/* Error + Submit */}
        {state.error && (
          <p className="text-sm text-(--admin-accent-studio) bg-(--admin-accent-studio)/8 border border-(--admin-accent-studio)/20 rounded-lg px-4 py-3">
            {state.error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm px-4 py-2 border border-black/10 rounded-lg text-text-muted hover:bg-black/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="text-sm px-5 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create essay"}
          </button>
        </div>
      </form>

      {/* Delete zone */}
      {isEdit && (
        <section className="bg-white border border-(--admin-accent-studio)/20 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-(--admin-accent-studio)">Danger zone</h2>
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="text-sm text-(--admin-accent-studio) hover:underline"
            >
              Delete this essay…
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Type <strong className="text-base-dark">{essay?.title}</strong> to confirm.
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                  className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 text-base-dark focus:outline-none focus:border-(--admin-accent-studio)/40"
              />
              {deleteError && <p className="text-xs text-(--admin-accent-studio)">{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteInput !== essay?.title}
                  className="text-sm px-4 py-2 bg-(--admin-accent-studio) text-white rounded-lg hover:bg-(--admin-accent-studio)/90 disabled:opacity-40 transition-colors"
                >
                  Delete essay
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDelete(false); setDeleteInput(""); setDeleteError(null); }}
                  className="text-sm px-4 py-2 border border-black/10 rounded-lg text-text-muted hover:bg-black/5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

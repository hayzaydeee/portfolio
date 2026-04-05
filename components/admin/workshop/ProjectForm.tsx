"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TagInput } from "@/components/admin/TagInput";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { MediaUpload } from "@/components/admin/MediaUpload";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { createProject, updateProject, deleteProject, uploadProjectThumbnail } from "@/app/actions/projects";
import type { Project, ProjectActionState } from "@/app/actions/projects";

type ProjectFormProps = {
  project?: Project;
};

export function ProjectForm({ project }: ProjectFormProps) {
  const router = useRouter();
  const isEdit = !!project;

  const boundAction = project
    ? updateProject.bind(null, project.id)
    : createProject;

  const [state, action, pending] = useActionState<ProjectActionState, FormData>(
    boundAction,
    { success: false }
  );

  // Thumbnail upload state
  const [thumbUrl, setThumbUrl] = useState<string | null>(project?.thumbnail_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Delete confirmation state
  const [showDelete, setShowDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Controlled field state (persists through server action error re-renders)
  const [title, setTitle] = useState(project?.title ?? "");
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [tagline, setTagline] = useState(project?.tagline ?? "");
  const [liveUrl, setLiveUrl] = useState(project?.live_url ?? "");
  const [repoUrl, setRepoUrl] = useState(project?.repo_url ?? "");
  const [status, setStatus] = useState(project?.status ?? "draft");
  const [orderIndex, setOrderIndex] = useState(String(project?.order_index ?? 0));
  const [isFeatured, setIsFeatured] = useState(project?.is_featured ?? false);
  const [personalNote, setPersonalNote] = useState(project?.personal_note ?? "");

  // Rich text refs (values set via hidden inputs from RichTextEditor)
  const formRef = useRef<HTMLFormElement>(null);

  // Redirect to workshop list on success (new project)
  useEffect(() => {
    if (state.success && state.id && !isEdit) {
      router.push(`/admin/workshop/${state.id}`);
    }
  }, [state.success, state.id, isEdit, router]);

  async function handleThumbnailFile(file: File) {
    if (!project?.id) {
      setUploadError("Save the project first, then upload a thumbnail");
      return;
    }
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadProjectThumbnail(project.id, fd);
    setUploading(false);
    if (result.success && result.url) {
      setThumbUrl(result.url);
    } else {
      setUploadError(result.error ?? "Upload failed");
    }
  }

  async function handleDelete() {
    if (!project) return;
    const result = await deleteProject(project.id, deleteInput);
    if (result.success) {
      router.push("/admin/workshop");
    } else {
      setDeleteError(result.error ?? "Delete failed");
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-8">
      {/* Identity */}
      <section className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-(--color-base-dark)">Identity</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-(--color-text-muted) mb-1">
              Project name <span className="text-[#8B1F35]">*</span>
            </label>
            <input
              name="title"
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-(--color-base-dark) focus:outline-none focus:border-accent/50"
            />
          </div>
          <div>
            <label className="block text-xs text-(--color-text-muted) mb-1">Slug</label>
            <input
              name="slug"
              type="text"
              required
              maxLength={100}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-project"
              pattern="[a-z0-9-]+"
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 font-mono text-(--color-base-dark) focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-(--color-text-muted) mb-1">
            One-line description <span className="text-xs text-(--color-text-muted)">(max 100 chars)</span>
          </label>
          <input
            name="tagline"
            type="text"
            maxLength={100}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-(--color-base-dark) focus:outline-none focus:border-accent/50"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-(--color-text-muted) mb-1">Live URL</label>
            <input
              name="live_url"
              type="url"
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              placeholder="https://"
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-(--color-base-dark) focus:outline-none focus:border-accent/50"
            />
          </div>
          <div>
            <label className="block text-xs text-(--color-text-muted) mb-1">Repository URL</label>
            <input
              name="repo_url"
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/"
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-(--color-base-dark) focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-(--color-text-muted) mb-1">Status</label>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-(--color-base-dark) bg-white focus:outline-none focus:border-accent/50"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="in_progress">In progress</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-(--color-text-muted) mb-1">Order index</label>
            <input
              name="order_index"
              type="number"
              min={0}
              value={orderIndex}
              onChange={(e) => setOrderIndex(e.target.value)}
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-(--color-base-dark) focus:outline-none focus:border-accent/50"
            />
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_featured"
                value="true"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded border-black/20"
              />
              <span className="text-xs text-(--color-base-dark)">Show in lobby</span>
            </label>
            <input type="hidden" name="is_featured" value="false" />
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="bg-white border border-black/10 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-medium text-(--color-base-dark)">Content</h2>

        <div>
          <label className="block text-xs text-(--color-text-muted) mb-1.5">The problem</label>
          <RichTextEditor
            name="problem_notes"
            initialHtml={project?.problem_notes ?? ""}
            placeholder="What gap existed?"
            autosaveEntryId={undefined}
          />
        </div>

        <div>
          <label className="block text-xs text-(--color-text-muted) mb-1.5">The build</label>
          <RichTextEditor
            name="build_notes"
            initialHtml={project?.build_notes ?? ""}
            placeholder="Architecture decisions, not a feature list."
            autosaveEntryId={undefined}
          />
        </div>

        <div>
          <label className="block text-xs text-(--color-text-muted) mb-1">
            Personal note <span className="text-xs text-(--color-text-muted)">(max 200 chars)</span>
          </label>
          <textarea
            name="personal_note"
            maxLength={200}
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            rows={2}
            placeholder="What the project taught or means."
            className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-(--color-base-dark) resize-none focus:outline-none focus:border-accent/50"
          />
        </div>
      </section>

      {/* Stack */}
      <section className="bg-white border border-black/10 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-medium text-(--color-base-dark)">Stack</h2>
        <TagInput
          name="stack"
          defaultTags={project?.stack ?? []}
          placeholder="Add technology"
        />
      </section>

      {/* Graphic */}
      <section className="bg-white border border-black/10 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-medium text-(--color-base-dark)">Project graphic</h2>
        {!isEdit && (
          <p className="text-xs text-(--color-text-muted)">Save the project first, then upload a graphic.</p>
        )}
        {isEdit && (
          <MediaUpload
            accept="image/jpeg,image/png,image/webp"
            maxBytes={5 * 1024 * 1024}
            maxLabel="5MB"
            currentUrl={thumbUrl}
            onFile={handleThumbnailFile}
            uploading={uploading}
            error={uploadError}
          />
        )}
        <input type="hidden" name="thumbnail_url" value={thumbUrl ?? ""} />
      </section>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="submit"
            name="status_action"
            value="draft"
            disabled={pending}
            className="text-sm px-4 py-2 border border-black/20 rounded-lg text-(--color-base-dark) hover:border-black/40 transition-colors disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save as draft"}
          </button>
          <button
            type="submit"
            name="status_action"
            value="publish"
            disabled={pending}
            className="text-sm px-4 py-2 border border-accent rounded-lg text-accent hover:bg-accent/5 transition-colors disabled:opacity-50"
          >
            Publish
          </button>
        </div>

        {isEdit && (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="text-xs text-(--color-text-muted) hover:text-[#8B1F35] transition-colors"
          >
            Delete project
          </button>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-[#8B1F35]">{state.error}</p>
      )}

      {/* Delete confirmation dialog */}
      {showDelete && project && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-sm font-medium text-(--color-base-dark)">Delete project</h3>
            <p className="text-xs text-(--color-text-muted)">
              This cannot be undone. Type{" "}
              <strong className="text-(--color-base-dark)">{project.title}</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={project.title}
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-(--color-base-dark) focus:outline-none focus:border-[#8B1F35]/50"
            />
            {deleteError && <p className="text-xs text-[#8B1F35]">{deleteError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowDelete(false); setDeleteInput(""); setDeleteError(null); }}
                className="flex-1 text-sm px-4 py-2 border border-black/20 rounded-lg text-(--color-base-dark)"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteInput !== project.title}
                className="flex-1 text-sm px-4 py-2 bg-[#8B1F35] text-white rounded-lg disabled:opacity-40"
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

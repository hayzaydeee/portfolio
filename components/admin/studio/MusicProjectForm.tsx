"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaUpload } from "@/components/admin/MediaUpload";
import {
  createMusicProject,
  updateMusicProject,
  deleteMusicProject,
  uploadMusicCover,
  addTrack,
  updateTrack,
  deleteTrack,
  uploadTrackAudio,
} from "@/app/actions/studio";
import type { MusicProject, Track, StudioActionState } from "@/app/actions/studio";

type MusicProjectFormProps = {
  project?: MusicProject;
};

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
] as const;

export function MusicProjectForm({ project }: MusicProjectFormProps) {
  const router = useRouter();
  const isEdit = !!project;

  const boundAction = project
    ? updateMusicProject.bind(null, project.id)
    : createMusicProject;

  const [state, action, pending] = useActionState<StudioActionState, FormData>(
    boundAction,
    { success: false }
  );

  // Artwork upload state
  const [artworkUrl, setArtworkUrl] = useState<string | null>(project?.artwork_path ?? null);
  const [artworkUploading, setArtworkUploading] = useState(false);
  const [artworkError, setArtworkError] = useState<string | null>(null);

  // Controlled field state (persists through server action error re-renders)
  const [title, setTitle] = useState(project?.title ?? "");
  const [slug, setSlug] = useState(project?.slug ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [releaseYear, setReleaseYear] = useState(String(project?.release_year ?? ""));
  const [status, setStatus] = useState(project?.status ?? "draft");
  const [sortOrder, setSortOrder] = useState(String(project?.sort_order ?? 0));
  const [isFeatured, setIsFeatured] = useState(project?.is_featured ?? false);
  const [isWip, setIsWip] = useState(project?.is_wip ?? false);

  // Track management state
  const [tracks, setTracks] = useState<Track[]>(
    [...(project?.tracks ?? [])].sort((a, b) => a.track_number - b.track_number)
  );
  const [newTrackTitle, setNewTrackTitle] = useState("");
  const [newTrackNumber, setNewTrackNumber] = useState(tracks.length + 1);
  const [addingTrack, setAddingTrack] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState<string | null>(null); // trackId

  // Delete confirmation state
  const [showDelete, setShowDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (state.success && state.id && !isEdit) {
      router.push(`/admin/studio/${state.id}`);
    }
  }, [state.success, state.id, isEdit, router]);

  async function handleArtworkFile(file: File) {
    if (!project?.id) {
      setArtworkError("Save the project first, then upload artwork");
      return;
    }
    setArtworkUploading(true);
    setArtworkError(null);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadMusicCover(project.id, fd);
    setArtworkUploading(false);
    if (result.success && result.url) {
      setArtworkUrl(result.url);
    } else {
      setArtworkError(result.error ?? "Upload failed");
    }
  }

  async function handleAddTrack() {
    if (!project?.id) {
      setTrackError("Save the project first, then add tracks");
      return;
    }
    if (!newTrackTitle.trim()) {
      setTrackError("Track title is required");
      return;
    }
    setAddingTrack(true);
    setTrackError(null);
    const fd = new FormData();
    fd.append("title", newTrackTitle.trim());
    fd.append("track_number", String(newTrackNumber));
    const result = await addTrack(project.id, { success: false }, fd);
    setAddingTrack(false);
    if (result.success && result.id) {
      const newTrack: Track = {
        id: result.id,
        music_project_id: project.id,
        title: newTrackTitle.trim(),
        audio_path: null,
        duration_seconds: null,
        track_number: newTrackNumber,
        created_at: new Date().toISOString(),
      };
      setTracks((prev) => [...prev, newTrack].sort((a, b) => a.track_number - b.track_number));
      setNewTrackTitle("");
      setNewTrackNumber((n) => n + 1);
    } else {
      setTrackError(result.error ?? "Failed to add track");
    }
  }

  async function handleDeleteTrack(trackId: string) {
    const result = await deleteTrack(trackId);
    if (result.success) {
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
    }
  }

  async function handleAudioFile(trackId: string, file: File) {
    setAudioUploading(trackId);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadTrackAudio(trackId, fd);
    setAudioUploading(null);
    if (result.success && result.url) {
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, audio_path: result.url! } : t))
      );
    }
  }

  async function handleUpdateTrackTitle(track: Track, title: string) {
    const fd = new FormData();
    fd.append("title", title);
    fd.append("track_number", String(track.track_number));
    if (track.duration_seconds != null) {
      fd.append("duration_seconds", String(track.duration_seconds));
    }
    await updateTrack(track.id, { success: false }, fd);
  }

  async function handleDelete() {
    if (!project) return;
    const result = await deleteMusicProject(project.id, deleteInput);
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
                maxLength={100}
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
                placeholder="my-project"
                pattern="[a-z0-9-]+"
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 font-mono text-base-dark focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Description <span className="text-xs text-text-muted">(max 150 chars)</span>
              </label>
              <input
                name="description"
                type="text"
                maxLength={150}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Release year</label>
              <input
                name="release_year"
                type="number"
                min={1900}
                max={2100}
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                placeholder={String(new Date().getFullYear())}
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>
        </section>

        {/* Status & Flags */}
        <section className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-base-dark">Status & flags</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Status</label>
              <select
                name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50 bg-white"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Sort order</label>
              <input
                name="sort_order"
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="flex flex-col gap-2 pt-5">
              <label className="flex items-center gap-2 text-sm text-base-dark cursor-pointer">
                <input
                  type="checkbox"
                  name="is_featured"
                  value="true"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="rounded border-black/20 accent-accent"
                />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm text-base-dark cursor-pointer">
                <input
                  type="checkbox"
                  name="is_wip"
                  value="true"
                  checked={isWip}
                  onChange={(e) => setIsWip(e.target.checked)}
                  className="rounded border-black/20 accent-accent"
                />
                In the lab (WIP)
              </label>
            </div>
          </div>
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
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create project"}
          </button>
        </div>
      </form>

      {/* Artwork — shown only when editing an existing project */}
      {isEdit && (
        <section className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-base-dark">Artwork</h2>
          <MediaUpload
            accept="image/jpeg,image/png,image/webp"
            maxBytes={5 * 1024 * 1024}
            maxLabel="5MB"
            currentUrl={artworkUrl}
            onFile={handleArtworkFile}
            uploading={artworkUploading}
            error={artworkError}
          />
        </section>
      )}

      {/* Tracklist — shown only when editing an existing project */}
      {isEdit && (
        <section className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-base-dark">Tracklist</h2>

          {tracks.length > 0 && (
            <div className="divide-y divide-black/5 border border-black/8 rounded-lg overflow-hidden">
              {tracks.map((track) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  audioUploading={audioUploading === track.id}
                  onDelete={() => handleDeleteTrack(track.id)}
                  onAudioFile={(file) => handleAudioFile(track.id, file)}
                  onTitleBlur={(title) => handleUpdateTrackTitle(track, title)}
                />
              ))}
            </div>
          )}

          {trackError && (
            <p className="text-xs text-(--admin-accent-studio)">{trackError}</p>
          )}

          {/* Add track row */}
          <div className="flex gap-2 items-end">
            <div className="w-14">
              <label className="block text-xs text-text-muted mb-1">#</label>
              <input
                type="number"
                min={1}
                value={newTrackNumber}
                onChange={(e) => setNewTrackNumber(Number(e.target.value))}
                className="w-full text-sm border border-black/10 rounded-lg px-2 py-2 text-base-dark focus:outline-none focus:border-accent/50 text-center"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-text-muted mb-1">Title</label>
              <input
                type="text"
                value={newTrackTitle}
                onChange={(e) => setNewTrackTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleAddTrack(); }
                }}
                placeholder="Track title"
                maxLength={200}
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 text-base-dark focus:outline-none focus:border-accent/50"
              />
            </div>
            <button
              type="button"
              onClick={handleAddTrack}
              disabled={addingTrack || !newTrackTitle.trim()}
              className="text-sm px-3 py-2 bg-accent/10 text-accent rounded-lg hover:bg-accent/20 disabled:opacity-40 transition-colors"
            >
              {addingTrack ? "Adding…" : "Add"}
            </button>
          </div>
        </section>
      )}

      {/* Delete zone — only for existing projects */}
      {isEdit && (
          <section className="bg-white border border-(--admin-accent-studio)/20 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-(--admin-accent-studio)">Danger zone</h2>
          {!showDelete ? (
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              className="text-sm text-(--admin-accent-studio) hover:underline"
            >
              Delete this project…
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Type <strong className="text-base-dark">{project?.title}</strong> to confirm.
              </p>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                  className="w-full text-sm border border-black/10 rounded-lg px-3 py-2 text-base-dark focus:outline-none focus:border-(--admin-accent-studio)/40"
              />
              {deleteError && (
                <p className="text-xs text-(--admin-accent-studio)">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteInput !== project?.title}
                  className="text-sm px-4 py-2 bg-(--admin-accent-studio) text-white rounded-lg hover:bg-(--admin-accent-studio)/90 disabled:opacity-40 transition-colors"
                >
                  Delete project
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

// ─── Track Row ────────────────────────────────────────────────────────────────

type TrackRowProps = {
  track: Track;
  audioUploading: boolean;
  onDelete: () => void;
  onAudioFile: (file: File) => void;
  onTitleBlur: (title: string) => void;
};

function TrackRow({ track, audioUploading, onDelete, onAudioFile, onTitleBlur }: TrackRowProps) {
  const [title, setTitle] = useState(track.title);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-black/2 transition-colors">
      <span className="w-6 text-center text-xs text-text-muted shrink-0">
        {track.track_number}
      </span>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (title.trim() !== track.title) onTitleBlur(title.trim() || track.title); }}
        maxLength={200}
        className="flex-1 text-sm text-base-dark bg-transparent border-0 focus:outline-none focus:ring-0 min-w-0"
      />
      {track.audio_path ? (
        <span className="text-xs text-accent shrink-0">✓ audio</span>
      ) : (
        <label className="text-xs text-text-muted hover:text-accent cursor-pointer shrink-0 transition-colors">
          {audioUploading ? "uploading…" : "+ audio"}
          <input
            type="file"
            accept="audio/mpeg,audio/wav,audio/flac"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAudioFile(file);
            }}
          />
        </label>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="text-xs text-text-muted hover:text-(--admin-accent-studio) transition-colors shrink-0"
        aria-label="Delete track"
      >
        ✕
      </button>
    </div>
  );
}

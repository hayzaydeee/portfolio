"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { MediaUpload } from "@/components/admin/MediaUpload";
import {
  createWallPiece,
  updateWallPiece,
  deleteWallPiece,
  uploadWallImage,
  uploadWallPreview,
} from "@/app/actions/wall";
import type { WallPiece, WallActionState } from "@/app/actions/wall";

type WallPieceFormProps = {
  piece?: WallPiece;
};

const TYPE_OPTIONS = [
  { value: "art", label: "Art piece" },
  { value: "video_short", label: "Short video" },
  { value: "video_long", label: "Long-form video" },
] as const;

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "hidden", label: "Hidden" },
] as const;

export function WallPieceForm({ piece }: WallPieceFormProps) {
  const router = useRouter();
  const isEdit = !!piece;

  const boundAction = piece
    ? updateWallPiece.bind(null, piece.id)
    : createWallPiece;

  const [state, action, pending] = useActionState<WallActionState, FormData>(
    boundAction,
    { success: false }
  );

  const [type, setType] = useState<WallPiece["type"]>(piece?.type ?? "art");
  const [status, setStatus] = useState(piece?.status ?? "draft");

  // Image upload state
  const [imageUrl, setImageUrl] = useState<string | null>(piece?.image_path ?? null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Preview video upload state
  const [previewUrl, setPreviewUrl] = useState<string | null>(piece?.preview_path ?? null);
  const [previewUploading, setPreviewUploading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Delete state
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (state.success && state.id && !isEdit) {
    router.push(`/admin/wall/${state.id}`);
  }

  async function handleImageFile(file: File) {
    if (!piece?.id) {
      setImageError("Save the piece first, then upload an image");
      return;
    }
    setImageUploading(true);
    setImageError(null);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadWallImage(piece.id, fd);
    setImageUploading(false);
    if (result.success && result.url) {
      setImageUrl(result.url);
    } else {
      setImageError(result.error ?? "Upload failed");
    }
  }

  async function handlePreviewFile(file: File) {
    if (!piece?.id) {
      setPreviewError("Save the piece first, then upload a preview");
      return;
    }
    setPreviewUploading(true);
    setPreviewError(null);
    const fd = new FormData();
    fd.append("file", file);
    const result = await uploadWallPreview(piece.id, fd);
    setPreviewUploading(false);
    if (result.success && result.url) {
      setPreviewUrl(result.url);
    } else {
      setPreviewError(result.error ?? "Upload failed");
    }
  }

  async function handleDelete() {
    if (!piece) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteWallPiece(piece.id);
    if (result.success) {
      router.push("/admin/wall");
    } else {
      setDeleting(false);
      setDeleteError(result.error ?? "Delete failed");
    }
  }

  const isVideo = type === "video_short" || type === "video_long";

  return (
    <div className="space-y-8">
      <form action={action} className="space-y-8">
        {/* Type selector */}
        <section className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-base-dark">Content type</h2>
          <div className="flex gap-3">
            {TYPE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value={opt.value}
                  checked={type === opt.value}
                  onChange={() => setType(opt.value)}
                  className="accent-accent"
                />
                <span className="text-sm text-base-dark">{opt.label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Content */}
        <section className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-base-dark">Content</h2>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              Caption <span className="text-xs text-text-muted">(max 200 chars)</span>
            </label>
            <input
              name="caption"
              type="text"
              maxLength={200}
              defaultValue={piece?.caption ?? ""}
              placeholder="A short caption for the polaroid"
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              Description <span className="text-xs text-text-muted">(optional, art only)</span>
            </label>
            <textarea
              name="description"
              rows={3}
              maxLength={1000}
              defaultValue={piece?.description ?? ""}
              placeholder="Longer description shown in the lightbox"
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Alt text</label>
            <input
              name="alt_text"
              type="text"
              maxLength={300}
              defaultValue={piece?.alt_text ?? ""}
              className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50"
            />
          </div>

          {isVideo && (
            <>
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  YouTube URL{" "}
                  <span className="text-xs text-text-muted">(long-form video)</span>
                </label>
                <input
                  name="youtube_url"
                  type="url"
                  defaultValue={piece?.youtube_url ?? ""}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 font-mono text-base-dark focus:outline-none focus:border-accent/50"
                />
              </div>
              {type === "video_long" && (
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    Duration <span className="text-xs text-text-muted">(e.g. 12:34)</span>
                  </label>
                  <input
                    name="duration"
                    type="text"
                    defaultValue={piece?.duration ?? ""}
                    placeholder="12:34"
                    pattern="\d+:\d{2}"
                    className="w-32 text-sm border border-black/10 rounded-lg px-3 py-2.5 font-mono text-base-dark focus:outline-none focus:border-accent/50"
                  />
                </div>
              )}
            </>
          )}
        </section>

        {/* Status */}
        <section className="bg-white border border-black/10 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-medium text-base-dark">Publishing</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Status</label>
              <select
                name="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as WallPiece["status"])}
                className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50 bg-white"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {status === "scheduled" && (
              <div>
                <label className="block text-xs text-text-muted mb-1">
                  Publish at <span className="text-xs text-text-muted">(time capsule)</span>
                </label>
                <input
                  name="publish_at"
                  type="datetime-local"
                  defaultValue={
                    piece?.publish_at
                      ? new Date(piece.publish_at).toISOString().slice(0, 16)
                      : ""
                  }
                  className="w-full text-sm border border-black/10 rounded-lg px-3 py-2.5 text-base-dark focus:outline-none focus:border-accent/50"
                />
              </div>
            )}
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
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create piece"}
          </button>
        </div>
      </form>

      {/* Media uploads — only when editing */}
      {isEdit && (
        <section className="bg-white border border-black/10 rounded-xl p-6 space-y-6">
          <h2 className="text-sm font-medium text-base-dark">
            {type === "art" ? "Image" : "Thumbnail / Preview image"}
          </h2>
          <MediaUpload
            accept="image/jpeg,image/png,image/webp"
            maxBytes={10 * 1024 * 1024}
            maxLabel="10MB"
            currentUrl={imageUrl}
            onFile={handleImageFile}
            uploading={imageUploading}
            error={imageError}
          />

          {isVideo && (
            <>
              <div className="border-t border-black/8 pt-6">
                <h3 className="text-xs font-medium text-text-muted mb-3">
                  30s video preview <span className="font-normal">(MP4 or WebM, max 50MB)</span>
                </h3>
                <MediaUpload
                  accept="video/mp4,video/webm"
                  maxBytes={50 * 1024 * 1024}
                  maxLabel="50MB"
                  currentUrl={previewUrl ?? undefined}
                  onFile={handlePreviewFile}
                  uploading={previewUploading}
                  error={previewError}
                />
              </div>
            </>
          )}
        </section>
      )}

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
              Delete this piece…
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                This will permanently delete the wall piece and cannot be undone.
              </p>
              {deleteError && (
                <p className="text-xs text-(--admin-accent-studio)">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-sm px-4 py-2 bg-(--admin-accent-studio) text-white rounded-lg hover:bg-(--admin-accent-studio)/90 disabled:opacity-40 transition-colors"
                >
                  {deleting ? "Deleting…" : "Delete piece"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDelete(false); setDeleteError(null); }}
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

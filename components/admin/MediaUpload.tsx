"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

type MediaUploadProps = {
  /** Accept MIME types string e.g. "image/jpeg,image/png,image/webp" */
  accept?: string;
  /** Max size in bytes */
  maxBytes?: number;
  /** Human readable max size label e.g. "5MB" */
  maxLabel?: string;
  /** Current preview URL */
  currentUrl?: string | null;
  /** Called with the selected File before upload */
  onFile: (file: File) => void | Promise<void>;
  /** Whether an upload is currently in progress */
  uploading?: boolean;
  /** 0-100 upload progress, shown when uploading */
  progress?: number;
  /** Error message to display */
  error?: string | null;
};

export function MediaUpload({
  accept = "image/jpeg,image/png,image/webp",
  maxBytes = 5 * 1024 * 1024,
  maxLabel = "5MB",
  currentUrl,
  onFile,
  uploading = false,
  progress,
  error,
}: MediaUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validate(file: File): string | null {
    const acceptedTypes = accept.split(",").map((t) => t.trim());
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      return `File type not supported. Accepted: ${accept}`;
    }
    if (file.size > maxBytes) {
      return `File too large (max ${maxLabel})`;
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) { setLocalError(err); return; }
    setLocalError(null);
    onFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const displayError = error ?? localError;

  return (
    <div className="space-y-2">
      {currentUrl && !uploading && (
        <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-black/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={currentUrl} alt="Current upload" className="w-full h-full object-cover" />
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={[
          "border-2 border-dashed rounded-lg px-6 py-8 text-center transition-colors cursor-pointer",
          dragging ? "border-accent bg-accent/5" : "border-black/15 hover:border-black/25",
          uploading ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="sr-only"
          tabIndex={-1}
        />

        {uploading ? (
          <div className="space-y-2">
            <p className="text-sm text-(--color-text-muted)">Uploading…</p>
            {progress != null && (
              <div className="w-full bg-black/10 rounded-full h-1.5">
                <div
                  className="bg-accent h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-(--color-base-dark)">
              Drop a file here, or{" "}
              <span className="text-accent underline">browse</span>
            </p>
            <p className="text-xs text-(--color-text-muted)">
              {accept.replace(/image\//g, "").replace(/,/g, ", ").toUpperCase()} · max {maxLabel}
            </p>
          </div>
        )}
      </div>

      {displayError && (
        <p className="text-xs text-[#8B1F35]">{displayError}</p>
      )}
    </div>
  );
}

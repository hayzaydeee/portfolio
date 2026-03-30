"use client";

import { useState, useRef, KeyboardEvent } from "react";

type TagInputProps = {
  /** Initial tags */
  defaultTags?: string[];
  /** Placeholder for the input */
  placeholder?: string;
  /** Hidden input name for form submission (JSON array) */
  name?: string;
  /** Max number of tags */
  max?: number;
  /** Called whenever the tag list changes */
  onChange?: (tags: string[]) => void;
};

export function TagInput({
  defaultTags = [],
  placeholder = "Add tag",
  name = "tags",
  max = 20,
  onChange,
}: TagInputProps) {
  const [tags, setTags] = useState<string[]>(defaultTags);
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag || tags.includes(tag) || tags.length >= max) return;
    const next = [...tags, tag];
    setTags(next);
    onChange?.(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeTag(tag: string) {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    onChange?.(next);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputRef.current?.value ?? "");
    } else if (e.key === "Backspace" && !inputRef.current?.value && tags.length > 0) {
      const next = tags.slice(0, -1);
      setTags(next);
      onChange?.(next);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border border-black/10 rounded-lg bg-white min-h-10 cursor-text"
         onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-black/6 rounded text-xs text-(--color-base-dark) font-mono"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            className="text-(--color-text-muted) hover:text-(--color-base-dark) leading-none"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        placeholder={tags.length === 0 ? placeholder : ""}
        onKeyDown={handleKeyDown}
        onBlur={(e) => { if (e.target.value) addTag(e.target.value); }}
        className="flex-1 min-w-24 outline-none text-sm text-(--color-base-dark) placeholder:text-(--color-text-muted) bg-transparent"
      />
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
    </div>
  );
}

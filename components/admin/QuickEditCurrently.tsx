"use client";

import { useActionState, useState } from "react";
import { upsertCurrently } from "@/app/actions/currently";
import type { Currently } from "@/lib/data/currently";

type QuickEditCurrentlyProps = {
  current: Currently | null;
};

const TYPE_OPTIONS: { value: Currently["type"]; label: string; defaultVerb: string }[] = [
  { value: "project",  label: "project",  defaultVerb: "building" },
  { value: "music",    label: "music",    defaultVerb: "listening to" },
  { value: "thought",  label: "thought",  defaultVerb: "thinking about" },
  { value: "film",     label: "film",     defaultVerb: "watching" },
  { value: "book",     label: "book",     defaultVerb: "reading" },
];

export function QuickEditCurrently({ current }: QuickEditCurrentlyProps) {
  const [state, action, pending] = useActionState(upsertCurrently, { success: false });
  const [selectedType, setSelectedType] = useState<Currently["type"]>(
    current?.type ?? "project"
  );

  const defaultVerb =
    TYPE_OPTIONS.find((t) => t.value === selectedType)?.defaultVerb ?? "building";

  return (
    <div className="space-y-3">
      {/* Current state display */}
      {current && (
        <p className="text-[10px] text-(--color-text-muted) leading-relaxed truncate" title={current.content}>
          <span className="text-(--lobby-text)/50">{current.verb}</span>{" "}
          {current.content}
        </p>
      )}

      <form action={action} className="space-y-2">
        {/* Type selector */}
        <div className="flex flex-wrap gap-1">
          {TYPE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedType(value)}
              className={[
                "px-1.5 py-0.5 rounded text-[10px] font-sans transition-colors",
                selectedType === value
                  ? "bg-white/15 text-(--lobby-text)"
                  : "text-(--color-text-muted) hover:text-(--lobby-text)",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <input type="hidden" name="type" value={selectedType} />

        {/* Verb */}
        <input
          type="text"
          name="verb"
          defaultValue={current?.verb ?? defaultVerb}
          placeholder={defaultVerb}
          maxLength={50}
          required
          className="w-full text-xs bg-white/8 border border-white/10 rounded px-2 py-1.5 text-(--lobby-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-white/25"
        />

        {/* Content */}
        <input
          type="text"
          name="content"
          defaultValue={current?.content ?? ""}
          placeholder="what are you working on?"
          maxLength={300}
          required
          className="w-full text-xs bg-white/8 border border-white/10 rounded px-2 py-1.5 text-(--lobby-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-white/25"
        />

        {/* Link (optional) */}
        <input
          type="url"
          name="link"
          defaultValue={current?.link ?? ""}
          placeholder="link (optional)"
          className="w-full text-xs bg-white/8 border border-white/10 rounded px-2 py-1.5 text-(--lobby-text) placeholder:text-(--color-text-muted) focus:outline-none focus:border-white/25"
        />

        {state.error && (
          <p className="text-[10px] text-[#C4855A]">{state.error}</p>
        )}
        {state.success && (
          <p className="text-[10px] text-accent-light">updated</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full text-xs font-sans py-1.5 rounded border border-white/15 text-(--color-text-muted) hover:bg-white/8 hover:text-(--lobby-text) transition-colors disabled:opacity-50"
        >
          {pending ? "saving…" : "update"}
        </button>
      </form>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef } from "react";
import { useActionState } from "react";
import { TagInput } from "@/components/admin/TagInput";
import {
  updateStackJson,
  getHighlightedStackJson,
} from "@/app/actions/settings";
import type { StackJson } from "@/app/actions/settings";

type Props = {
  initialStack: StackJson;
  initialPreviewHtml: string;
};

const INITIAL_STATE = { success: false as const };

const SECTIONS: { key: keyof StackJson; label: string; placeholder: string }[] = [
  { key: "languages", label: "Languages", placeholder: "e.g. typescript" },
  { key: "frontend", label: "Frontend", placeholder: "e.g. react" },
  { key: "backend", label: "Backend", placeholder: "e.g. node.js" },
  { key: "tools", label: "Tools", placeholder: "e.g. figma" },
];

export function StackEditor({ initialStack, initialPreviewHtml }: Props) {
  const [stack, setStack] = useState<StackJson>(initialStack);
  const [previewHtml, setPreviewHtml] = useState(initialPreviewHtml);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, formAction, isPending] = useActionState(updateStackJson, INITIAL_STATE);

  const updatePreview = useCallback((newStack: StackJson) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const html = await getHighlightedStackJson(newStack);
      setPreviewHtml(html);
    }, 400);
  }, []);

  function handleChange(key: keyof StackJson) {
    return (tags: string[]) => {
      const newStack = { ...stack, [key]: tags };
      setStack(newStack);
      updatePreview(newStack);
    };
  }

  return (
    <form action={formAction}>
      {/* Hidden JSON inputs for form submission */}
      <input type="hidden" name="languages" value={JSON.stringify(stack.languages)} />
      <input type="hidden" name="frontend" value={JSON.stringify(stack.frontend)} />
      <input type="hidden" name="backend" value={JSON.stringify(stack.backend)} />
      <input type="hidden" name="tools" value={JSON.stringify(stack.tools)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Tag inputs */}
        <div className="space-y-4">
          {SECTIONS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-sans font-medium text-text-muted uppercase tracking-wider mb-1.5">
                {label}
              </label>
              <TagInput
                defaultTags={initialStack[key]}
                placeholder={placeholder}
                name={`${key}_display`}
                onChange={handleChange(key)}
              />
            </div>
          ))}

          {/* Save */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-sans rounded-lg border border-black/15 text-base-dark bg-black/4 hover:bg-black/8 disabled:opacity-50 transition-colors"
            >
              {isPending ? "Saving…" : "Save stack"}
            </button>
            {state.success && (
              <span className="text-xs text-green-700">{state.message ?? "Saved"}</span>
            )}
            {!state.success && state.error && (
              <span className="text-xs text-red-600">{state.error}</span>
            )}
          </div>
        </div>

        {/* Right: Live JSON preview (forest dark) */}
        <div className="rounded-xl overflow-hidden border border-white/8 bg-(--workshop-base)">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/8">
            <span className="w-2 h-2 rounded-full bg-(--workshop-accent)" />
            <span className="text-xs font-mono text-(--workshop-text-muted)">
              stack.json
            </span>
          </div>
          <div
            className="text-sm overflow-auto max-h-96"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </form>
  );
}

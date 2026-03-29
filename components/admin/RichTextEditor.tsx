"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { autosaveEntry } from "@/app/actions/notebook";

// ─── Toolbar ──────────────────────────────────────────────────────────────────

type ToolbarProps = {
  editor: Editor | null;
};

function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 border-b border-black/10 px-3 py-2 flex-wrap">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="Bold"
      >
        B
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="Italic"
      >
        <em>I</em>
      </ToolbarButton>
      <div className="w-px h-4 bg-black/15 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="Heading 2"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="Heading 3"
      >
        H3
      </ToolbarButton>
      <div className="w-px h-4 bg-black/15 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="Blockquote"
      >
        &ldquo;
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        title="Code block"
      >
        {"</>"}
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        active={false}
        title="Horizontal rule"
      >
        —
      </ToolbarButton>
    </div>
  );
}

type ToolbarButtonProps = {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({ onClick, active, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={[
        "px-2 py-1 rounded text-sm font-mono leading-none transition-colors",
        active
          ? "bg-black/8 text-(--color-base-dark)"
          : "text-(--color-text-muted) hover:bg-black/5 hover:text-(--color-base-dark)",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ─── Save status indicator ────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ─── Main component ───────────────────────────────────────────────────────────

type RichTextEditorProps = {
  /** Initial HTML content */
  initialHtml?: string;
  /** Called when content changes — receive new HTML */
  onChange?: (html: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** For autosave: the existing entry ID (only when editing) */
  autosaveEntryId?: string;
  /** Hidden input name for form submission */
  name?: string;
  /** Min height class */
  minHeight?: string;
};

export function RichTextEditor({
  initialHtml = "",
  onChange,
  placeholder = "Start writing…",
  autosaveEntryId,
  name = "body_html",
  minHeight = "min-h-64",
}: RichTextEditorProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const saveStatusRef = useRef<SaveStatus>("idle");
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(initialHtml);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      CharacterCount,
    ],
    content: initialHtml,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      if (hiddenRef.current) hiddenRef.current.value = html;
      onChange?.(html);

      // Schedule autosave if editing an existing entry
      if (autosaveEntryId && html !== lastSavedRef.current) {
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(async () => {
          saveStatusRef.current = "saving";
          const result = await autosaveEntry(autosaveEntryId, html);
          saveStatusRef.current = result.success ? "saved" : "error";
          lastSavedRef.current = html;
        }, 30_000);
      }
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  return (
    <div className="border border-black/10 rounded-lg overflow-hidden bg-white">
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        className={[
          "prose prose-sm max-w-none px-4 py-3 focus-within:outline-none",
          minHeight,
          "[&_.tiptap]:outline-none [&_.tiptap]:min-h-inherit",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:text-(--color-text-muted)",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:float-left",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none",
        ].join(" ")}
      />
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        defaultValue={initialHtml}
      />
    </div>
  );
}

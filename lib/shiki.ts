import type { Highlighter } from "shiki";
import { createHighlighter } from "shiki";

// ─── Custom forest theme ──────────────────────────────────────────────────────

const forestTheme = {
  name: "forest",
  type: "dark" as const,
  colors: {
    "editor.background": "#0A120D",
    "editor.foreground": "#A8C5A0",
    "editor.selectionBackground": "#1E3B25",
    "editor.lineHighlightBackground": "#0D1A0F",
  },
  tokenColors: [
    {
      scope: [
        "keyword",
        "storage",
        "storage.type",
        "keyword.control",
        "keyword.operator",
        "keyword.other",
      ],
      settings: { foreground: "#52A873" },
    },
    {
      scope: ["string", "string.quoted", "string.template"],
      settings: { foreground: "#2D6B42" },
    },
    {
      scope: ["comment", "comment.line", "comment.block", "punctuation.definition.comment"],
      settings: { foreground: "#5A7A5E", fontStyle: "italic" },
    },
    {
      scope: ["variable", "variable.other", "entity.name.variable"],
      settings: { foreground: "#A8C5A0" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call.generic",
      ],
      settings: { foreground: "#6DAA7A" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
      ],
      settings: { foreground: "#70A878" },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: { foreground: "#7AB08A" },
    },
    {
      scope: ["punctuation", "meta.brace", "meta.delimiter"],
      settings: { foreground: "#4A6B4A" },
    },
  ],
};

// ─── Singleton ────────────────────────────────────────────────────────────────

let _highlighter: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!_highlighter) {
    _highlighter = createHighlighter({
      themes: [forestTheme],
      langs: [
        "typescript",
        "javascript",
        "tsx",
        "jsx",
        "json",
        "jsonc",
        "bash",
        "css",
        "html",
        "python",
      ],
    }).catch((err) => {
      // Reset so the next call retries rather than re-throwing forever
      _highlighter = null;
      throw err;
    });
  }
  return _highlighter;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function highlight(code: string, lang: string): Promise<string> {
  const h = await getHighlighter();
  try {
    return h.codeToHtml(code, { lang, theme: "forest" });
  } catch {
    // Fallback to escaped plain text if language is not supported
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre style="background:#0A120D;color:#A8C5A0;padding:1rem;overflow:auto"><code>${escaped}</code></pre>`;
  }
}

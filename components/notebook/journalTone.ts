import type { Journal } from "@/lib/notebook/journals";

/** Each journal's cloth colour as a fill class (Tailwind needs the full class names in source) */
export const JOURNAL_SWATCH: Record<Journal, string> = {
  reflections: "bg-(--notebook-reflections)",
  fragments: "bg-(--notebook-fragments)",
  annotations: "bg-(--notebook-annotations)",
  responses: "bg-(--notebook-responses)",
  buildlog: "bg-(--notebook-buildlog)",
  cookbook: "bg-(--notebook-cookbook)",
};

/** …and as a text and decoration colour, for accents on the cream page */
export const JOURNAL_INK: Record<Journal, string> = {
  reflections: "text-(--notebook-reflections) decoration-(--notebook-reflections)",
  fragments: "text-(--notebook-fragments) decoration-(--notebook-fragments)",
  annotations: "text-(--notebook-annotations) decoration-(--notebook-annotations)",
  responses: "text-(--notebook-responses) decoration-(--notebook-responses)",
  buildlog: "text-(--notebook-buildlog) decoration-(--notebook-buildlog)",
  cookbook: "text-(--notebook-cookbook) decoration-(--notebook-cookbook)",
};

import "server-only";
import DOMPurify from "isomorphic-dompurify";

/**
 * An entry's body, sanitized where it renders: on the server, once per build or revalidation.
 * The page ships clean HTML, and the browser never downloads DOMPurify for it.
 */
export function entryHtml(raw: string | null): string {
  return DOMPurify.sanitize(raw ?? "");
}

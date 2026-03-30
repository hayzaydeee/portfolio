import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "notebook — hayzaydee",
  description: "Five journals. Reflections, fragments, annotations, responses, and build log.",
};

export default function NotebookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--notebook-surface)", color: "var(--notebook-text)" }}
    >
      {children}
    </div>
  );
}

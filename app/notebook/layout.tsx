import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "notebook — hayzaydee",
  description: "Six journals. Reflections, fragments, annotations, responses, build log, and a cookbook.",
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

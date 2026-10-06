import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "notebook — hayzaydee",
  description: "Six journals. Reflections, fragments, annotations, responses, build log, and a cookbook.",
};

export default function NotebookLayout({ children }: { children: React.ReactNode }) {
  // Pages clear the floating modern dock themselves, so their textures run under it
  return <div className="min-h-screen bg-(--notebook-surface) text-(--notebook-text)">{children}</div>;
}

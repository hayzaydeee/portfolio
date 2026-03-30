import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Wall — hzy",
  description: "Art, video, and things pinned over time.",
};

export default function WallLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--wall-surface)", color: "var(--wall-caption)" }}
    >
      {children}
    </div>
  );
}

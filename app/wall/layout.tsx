import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Wall — hzy",
  description: "Art, video, and things pinned over time.",
};

export default function WallLayout({ children }: { children: React.ReactNode }) {
  // The page clears the floating modern dock itself, so its texture runs under it
  return <div className="min-h-screen bg-(--wall-surface) text-(--wall-caption)">{children}</div>;
}

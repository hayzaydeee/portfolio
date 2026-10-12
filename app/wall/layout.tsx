import type { Metadata } from "next";
import { WallBackdrop } from "@/components/wall/WallBackdrop";

export const metadata: Metadata = {
  title: "The Wall — hzy",
  description: "Art, video, and things pinned over time.",
};

export default function WallLayout({ children }: { children: React.ReactNode }) {
  // The page clears the floating modern dock itself, so its texture runs under it. The wrapper
  // is its own stacking context so the window light (fixed, at the backdrop's negative z)
  // paints over the wall's colour and under the page, rather than under the colour.
  return (
    <div className="isolate min-h-screen bg-(--wall-surface) text-(--wall-caption)">
      <WallBackdrop />
      {children}
    </div>
  );
}

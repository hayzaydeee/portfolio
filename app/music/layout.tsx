import type { Metadata } from "next";
import { StudioBackdrop } from "@/components/studio/StudioBackdrop";

export const metadata: Metadata = {
  title: "studio — hayzaydee",
  description: "Music, tracks, and critical analysis from Divine Eze.",
};

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  // The glass dock is a top bar on phones and a left rail from md (icon-only until xl).
  // No background or z-index here: the bell field sits underneath in the root stacking context.
  return (
    <div className="relative min-h-screen text-(--studio-text) pt-16 md:pt-0 md:pl-24 xl:pl-60">
      <StudioBackdrop />
      {children}
    </div>
  );
}

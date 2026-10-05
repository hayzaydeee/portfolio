import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "studio — hayzaydee",
  description: "Music, tracks, and critical analysis from Divine Eze.",
};

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  // The glass dock is a top bar on phones and a left rail from md (icon-only until xl)
  return (
    <div className="min-h-screen bg-(--studio-base) text-(--studio-text) pt-16 md:pt-0 md:pl-24 xl:pl-60">
      {children}
    </div>
  );
}

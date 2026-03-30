import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "studio — hayzaydee",
  description: "Music, tracks, and critical analysis from Divine Eze.",
};

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen" style={{ background: "var(--studio-base)", color: "var(--studio-text)" }}>{children}</div>;
}

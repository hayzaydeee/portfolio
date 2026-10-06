import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "fx harness",
  robots: { index: false, follow: false },
};

export default function HarnessLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-base-dark">{children}</div>;
}

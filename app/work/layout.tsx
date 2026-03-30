import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workshop — hayzaydee",
  description: "Projects, code, and technical work by Divine Eze.",
};

export default function WorkshopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No global Nav/Footer — the Workshop is a self-contained IDE environment
  return (
    <div
      className="min-h-screen flex flex-col bg-(--workshop-base) text-(--workshop-text)"
    >
      {children}
    </div>
  );
}

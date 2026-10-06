import type { Metadata } from "next";
import { WorkshopTopBar } from "@/components/workshop/WorkshopTopBar";

export const metadata: Metadata = {
  title: "Workshop — hayzaydee",
  description: "Projects, code, and technical work by Divine Eze.",
};

export default function WorkshopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A self-contained IDE: the title bar (which is the dock) stays put while pages and
  // their loading states swap underneath it
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-(--workshop-base) text-(--workshop-text)">
      <WorkshopTopBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
    </div>
  );
}

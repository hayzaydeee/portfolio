import type { Metadata } from "next";
import { WorkshopTopBar } from "@/components/workshop/WorkshopTopBar";
import { WorkshopBackdrop } from "@/components/workshop/WorkshopBackdrop";
import { WorkshopEntry } from "@/components/workshop/WorkshopBoot";

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
    // No background or z-index here: the backdrop sits in the root stacking context underneath,
    // and the dock keeps its place above the rest of the page
    <div className="relative flex h-screen flex-col overflow-hidden text-(--workshop-text)">
      <WorkshopBackdrop />
      <WorkshopEntry />
      <WorkshopTopBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
    </div>
  );
}

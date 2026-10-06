"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import { Dock } from "@/components/fx/ui/Dock";

/**
 * The IDE's title bar is the workshop's dock: retro variant, path crumbs on the left.
 * Mounted once in the /work layout, so it persists across project pages and loading states;
 * the crumbs follow the URL below /work.
 */
export function WorkshopTopBar() {
  const crumbs = useSelectedLayoutSegments().map((s) => decodeURIComponent(s));
  return (
    <header className="shrink-0">
      <Dock variant="retro" room="workshop" crumbs={crumbs} />
    </header>
  );
}

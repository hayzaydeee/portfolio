"use client";

import { Dock } from "@/components/fx/ui/Dock";

/** The IDE's title bar is the workshop's dock: retro variant, path crumbs on the left */
export function WorkshopTopBar({ crumbs }: { crumbs?: string[] }) {
  return (
    <header className="shrink-0">
      <Dock variant="retro" room="workshop" crumbs={crumbs} />
    </header>
  );
}

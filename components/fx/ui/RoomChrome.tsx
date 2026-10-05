"use client";

import { usePathname } from "next/navigation";
import { useSplashActive } from "@/lib/splash-context";
import { DOCK_VARIANT, roomForPath } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import { Dock } from "./Dock";

/**
 * Mounts the dock for whichever room the URL is in. The workshop embeds its retro dock in
 * the IDE bar instead (WorkshopTopBar), and admin/harness routes get none. Keyed by variant,
 * so moving between notebook and wall keeps one modern dock and just recolours it.
 */
export function RoomChrome() {
  const pathname = usePathname();
  const splashActive = useSplashActive();
  const room = roomForPath(pathname);
  if (!room) return null;

  const variant = DOCK_VARIANT[room];
  if (variant === "retro") return null;

  return (
    <div
      className={cn("dock-anchor", variant === "glass" ? "dock-anchor--rail" : "dock-anchor--top")}
      data-splash={splashActive}
      inert={splashActive}
    >
      <Dock key={variant} variant={variant} room={room} />
    </div>
  );
}

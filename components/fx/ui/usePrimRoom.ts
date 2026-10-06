"use client";

import { usePathname } from "next/navigation";
import { roomForPath } from "@/lib/rooms";
import type { RoomKey } from "@/components/fx/runtime/types";

/** The room a primitive draws its colours from: the one given, else the one the URL is in */
export function usePrimRoom(room?: RoomKey): RoomKey {
  const pathname = usePathname();
  return room ?? roomForPath(pathname ?? "/") ?? "lobby";
}

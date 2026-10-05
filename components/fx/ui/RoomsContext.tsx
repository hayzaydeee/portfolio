"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RoomVisibility } from "@/lib/rooms";

const ALL_VISIBLE: RoomVisibility = { workshop: true, studio: true, notebook: true, wall: true };

const RoomsContext = createContext<RoomVisibility>(ALL_VISIBLE);

/** Which rooms admin settings currently show in the dock; static per document */
export function RoomsProvider({ rooms, children }: { rooms: RoomVisibility; children: ReactNode }) {
  return <RoomsContext.Provider value={rooms}>{children}</RoomsContext.Provider>;
}

export function useRoomVisibility(): RoomVisibility {
  return useContext(RoomsContext);
}

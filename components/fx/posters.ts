import type { RoomKey } from "./runtime/types";

/** Full class strings (Tailwind can't see dynamically built names) for gradient posters */
export const ROOM_POSTER_CLASS: Record<RoomKey, string> = {
  lobby: "bg-(--lobby-surface)",
  workshop: "bg-(--workshop-base)",
  studio: "bg-(--studio-base)",
  notebook: "bg-(--notebook-surface)",
  wall: "bg-(--wall-surface)",
};

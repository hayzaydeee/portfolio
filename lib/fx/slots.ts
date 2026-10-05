import type { FxId } from "@/components/fx/metas";
import type { RoomKey } from "@/components/fx/runtime/types";

/**
 * Named places on the site where an effect renders. Presets are tuned per slot in
 * /admin/lab, so the same effect can look different in two rooms.
 */
export const FX_SLOTS = {
  "lobby.backdrop": { effect: "emerald-horizon", room: "lobby", label: "Lobby backdrop" },
  "studio.backdrop": { effect: "bell-field", room: "studio", label: "Studio backdrop" },
} as const satisfies Record<string, { effect: FxId; room: RoomKey; label: string }>;

export type FxSlotId = keyof typeof FX_SLOTS;

export const FX_SLOT_IDS = Object.keys(FX_SLOTS) as FxSlotId[];

export function isFxSlotId(id: string): id is FxSlotId {
  return id in FX_SLOTS;
}

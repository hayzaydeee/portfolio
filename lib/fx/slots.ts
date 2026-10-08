import type { FxId } from "@/components/fx/metas";
import type { RoomKey } from "@/components/fx/runtime/types";

/**
 * Named places on the site where an effect renders. Presets are tuned per slot in
 * /admin/lab, so the same effect can look different in two rooms.
 */
export const FX_SLOTS = {
  "lobby.backdrop": { effect: "emerald-horizon", room: "lobby", label: "Lobby backdrop" },
  "workshop.backdrop": { effect: "dot-matrix", room: "workshop", label: "Workshop backdrop" },
  "workshop.boot": { effect: "crt-boot", room: "workshop", label: "Workshop · CRT boot" },
  "workshop.lifelog": { effect: "condensation", room: "workshop", label: "Workshop · life.log glass" },
  "studio.backdrop": { effect: "bell-field", room: "studio", label: "Studio backdrop" },
  "workshop.dock": { effect: "dock-retro", room: "workshop", label: "Workshop dock field" },
  "studio.dock": { effect: "dock-glass", room: "studio", label: "Studio dock field" },
  "portal.field": { effect: "portal-field", room: "lobby", label: "Transition · portal field" },
  "portal.vortex": { effect: "glyph-vortex", room: "lobby", label: "Transition · glyph vortex" },
  "lobby.about": { effect: "glyph-ball", room: "lobby", label: "Lobby · about sphere" },
  "lobby.seedling": { effect: "generative-tree", room: "lobby", label: "Lobby · seedling tree" },
  "site.emblem": { effect: "outline-typeflow", room: "lobby", label: "Footer · HZY emblem" },
  "studio.about": { effect: "liquid-form", room: "studio", label: "Studio · liquid form behind the about", off: true },
  "notebook.shelf": { effect: "bookshelf", room: "notebook", label: "Notebook · the shelf" },
  "notebook.cloth": { effect: "cloth-study", room: "notebook", label: "Notebook · cloth heading" },
} as const satisfies Record<string, { effect: FxId; room: RoomKey; label: string; off?: true }>;

export type FxSlotId = keyof typeof FX_SLOTS;

/** Slots marked `off` stay dark until the lab switches them on */
export function slotOnByDefault(id: FxSlotId): boolean {
  return !("off" in FX_SLOTS[id]);
}

export const FX_SLOT_IDS = Object.keys(FX_SLOTS) as FxSlotId[];

export function isFxSlotId(id: string): id is FxSlotId {
  return id in FX_SLOTS;
}

/** Backdrop slots hold the portal's reveal until their first frame lands */
export function isBackdropSlot(id: FxSlotId): boolean {
  return id.endsWith(".backdrop");
}

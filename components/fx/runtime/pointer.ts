/**
 * One window-level pointer store. Stage canvases stay pointer-events:none so they never
 * steal input from content layered over them; renderers read this store instead.
 */

type PointerState = {
  clientX: number;
  clientY: number;
  seen: boolean;
  clickHandlers: Set<(e: PointerEvent) => void>;
};

const GLOBAL_KEY = "__hzyFxPointer";
type G = typeof globalThis & { [GLOBAL_KEY]?: PointerState };

const INTERACTIVE = "a, button, input, select, textarea, label, [role=button], [data-fx-ignore]";

function state(): PointerState {
  const g = globalThis as G;
  if (!g[GLOBAL_KEY]) {
    const s: PointerState = { clientX: 0, clientY: 0, seen: false, clickHandlers: new Set() };
    window.addEventListener(
      "pointermove",
      (e) => {
        s.clientX = e.clientX;
        s.clientY = e.clientY;
        s.seen = true;
      },
      { passive: true }
    );
    window.addEventListener(
      "pointerdown",
      (e) => {
        s.clientX = e.clientX;
        s.clientY = e.clientY;
        s.seen = true;
        if ((e.target as Element | null)?.closest?.(INTERACTIVE)) return;
        s.clickHandlers.forEach((cb) => cb(e));
      },
      { passive: true }
    );
    g[GLOBAL_KEY] = s;
  }
  return g[GLOBAL_KEY]!;
}

export function readPointer() {
  const s = state();
  return { clientX: s.clientX, clientY: s.clientY, seen: s.seen };
}

/** Clicks on non-interactive page areas; the stage filters by its own bounds */
export function onStageClick(cb: (e: PointerEvent) => void): () => void {
  const s = state();
  s.clickHandlers.add(cb);
  return () => s.clickHandlers.delete(cb);
}

/**
 * Sequence mode turns wheel, swipe and arrow keys into slide changes. A section that needs
 * those gestures itself marks its area with data-gesture-capture: "x" claims horizontal
 * gestures only (the project wave), "all" claims everything (a surface you drag around).
 */

/** Whether the element under a gesture has claimed a movement of (dx, dy) */
export function gestureCaptured(target: EventTarget | null, dx: number, dy: number): boolean {
  const el = (target as Element | null)?.closest?.("[data-gesture-capture]") as HTMLElement | null;
  if (!el) return false;
  if (el.dataset.gestureCapture === "x") return Math.abs(dx) > Math.abs(dy);
  return true;
}

const ACTIVATES_ON_SPACE = "a, button, input, select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=switch], [contenteditable]";
const EDITABLE = "input, select, textarea, [contenteditable]";

/** Keys the focused element owns: Space presses buttons and links, arrows move carets */
export function keyBelongsToTarget(e: KeyboardEvent): boolean {
  const t = e.target as Element | null;
  if (!t?.closest) return false;
  if (e.key === " ") return !!t.closest(ACTIVATES_ON_SPACE);
  return !!t.closest(EDITABLE) || !!t.closest('[data-gesture-capture="all"]');
}

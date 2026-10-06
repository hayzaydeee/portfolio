/**
 * ResizeObserver with a settle window. Mobile toolbars collapsing fire a stream of small
 * resizes; reallocating a drawing buffer on each one stutters. Small changes wait 150ms,
 * large ones (> 8% in either axis) apply immediately.
 */
export function observeSize(
  el: HTMLElement,
  cb: (width: number, height: number) => void
): () => void {
  let last: { w: number; h: number } | null = null;
  let timer = 0;

  const apply = (w: number, h: number) => {
    last = { w, h };
    cb(w, h);
  };

  const ro = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const { width: w, height: h } = entry.contentRect;
    window.clearTimeout(timer);
    if (!last) return apply(w, h);
    const big = Math.abs(w - last.w) / Math.max(last.w, 1) > 0.08 || Math.abs(h - last.h) / Math.max(last.h, 1) > 0.08;
    if (big) apply(w, h);
    else timer = window.setTimeout(() => apply(w, h), 150);
  });
  ro.observe(el);
  return () => {
    window.clearTimeout(timer);
    ro.disconnect();
  };
}

/**
 * Canvas text can't take CSS variables, and next/font exposes hashed family names only
 * through --font-* properties. Resolve the real family and wait for it before rasterising
 * any glyphs, or effects bake fallback fonts into their atlases.
 */
export function resolveFontFamily(cssVar: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return value || "sans-serif";
}

export async function loadFont(weight: number | string, sizePx: number, family: string): Promise<void> {
  if (!document.fonts?.load) return;
  try {
    await document.fonts.load(`${weight} ${sizePx}px ${family}`);
  } catch {
    // fall through to whatever the browser has
  }
}

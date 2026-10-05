import type { PaletteRole, RGB, RoomKey, RoomPalette } from "./types";

/**
 * Room palettes are the :root tokens in app/globals.css. This map is the only place that
 * ties effect colour roles to those tokens; renderers never hardcode room colours.
 */
export const ROOM_TOKEN_MAP: Record<RoomKey, Record<PaletteRole, string>> = {
  lobby: {
    base: "--lobby-surface",
    surface: "--lobby-surface-deep",
    text: "--lobby-text",
    muted: "--color-text-muted",
    accent: "--color-accent",
    glow: "--lobby-accent",
    deep: "--lobby-card",
    warm: "--lobby-warm",
  },
  workshop: {
    base: "--workshop-base",
    surface: "--workshop-panel",
    text: "--workshop-text",
    muted: "--workshop-text-muted",
    accent: "--workshop-accent",
    glow: "--workshop-syntax",
    deep: "--workshop-syntax-dim",
    warm: "--workshop-warm",
  },
  studio: {
    base: "--studio-base",
    surface: "--studio-panel",
    text: "--studio-text",
    muted: "--studio-text-muted",
    accent: "--studio-accent",
    glow: "--studio-accent-light",
    deep: "--studio-raised",
    warm: "--studio-ember",
  },
  notebook: {
    base: "--notebook-surface",
    surface: "--notebook-shadow",
    text: "--notebook-text",
    muted: "--notebook-text-muted",
    accent: "--notebook-reflections",
    glow: "--notebook-cookbook",
    deep: "--notebook-annotations",
    warm: "--notebook-fragments",
  },
  wall: {
    base: "--wall-surface",
    surface: "--wall-texture",
    text: "--wall-caption",
    muted: "--wall-date",
    accent: "--wall-pin",
    glow: "--wall-polaroid",
    deep: "--wall-caption",
    warm: "--admin-accent-wall",
  },
};

export const ROOM_KEYS = Object.keys(ROOM_TOKEN_MAP) as RoomKey[];

const FALLBACK: RGB = [0.5, 0.5, 0.5];
const cache = new Map<string, RGB>();
let probe: CanvasRenderingContext2D | null = null;

/**
 * Normalise any CSS colour (hex, rgb(a), named, oklch...) through a canvas fillStyle,
 * which serialises to "#rrggbb" or "rgba(r, g, b, a)".
 */
function parseCssColor(value: string): RGB {
  if (!probe) probe = document.createElement("canvas").getContext("2d");
  if (!probe || !value) return FALLBACK;
  probe.fillStyle = "#000";
  probe.fillStyle = value;
  const out = probe.fillStyle;
  if (out.startsWith("#")) {
    const n = parseInt(out.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const m = out.match(/rgba?\(([^)]+)\)/);
  if (!m) return FALLBACK;
  const [r, g, b] = m[1].split(",").map((s) => parseFloat(s));
  return [r / 255, g / 255, b / 255];
}

/** Resolve one custom property (e.g. "--studio-accent" or "studio-accent") to sRGB. Client only. */
export function resolveToken(token: string): RGB {
  const name = token.startsWith("--") ? token : `--${token}`;
  const hit = cache.get(name);
  if (hit) return hit;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const rgb = parseCssColor(raw);
  cache.set(name, rgb);
  return rgb;
}

/** Read a room's palette from :root. Client only, never during render. */
export function getRoomPalette(room: RoomKey): RoomPalette {
  const map = ROOM_TOKEN_MAP[room];
  const palette = { room } as RoomPalette;
  for (const role of Object.keys(map) as PaletteRole[]) {
    palette[role] = resolveToken(map[role]);
  }
  return palette;
}

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function rgbToCss([r, g, b]: RGB, alpha = 1): string {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha})`;
}

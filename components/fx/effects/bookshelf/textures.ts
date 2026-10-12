import { seeded } from "@/components/fx/runtime/random";
import type { ShelfVolume } from "./meta";

/**
 * The Bookshelf's surfaces, painted on 2D canvases the way the original paints them: cloth
 * grain, foil type, paper stock, page edges. Colours arrive as CSS strings from the room
 * palette; nothing here knows three.
 */

export type Fonts = { serif: string; mono: string; script: string };

/** What a volume's painters need beyond the volume itself */
export type Look = {
  vol: ShelfVolume;
  seed: number;
  cloth: string;
  /** Foil and printed rule colour */
  foil: string;
  /** Page ink: the cloth darkened toward the room's text */
  ink: string;
  /** Paper stock: the room's surface */
  paper: string;
  motif: Motif;
};

export type Motif = "paths" | "modules" | "frames" | "orbits" | "brackets" | "bowl";

/** FNV-1a, so a volume's grain lands the same way on every visit */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function canvas2d(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

const rng = (look: Look, salt: string) => seeded(hash(`${look.vol.id}-${salt}`) + look.seed);

function spaced(g: CanvasRenderingContext2D, px: number) {
  // Letter spacing on canvas is recent; where it's missing the type just sets tighter
  (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${px}px`;
}

/** The journal's mark, drawn in foil: the original's six system motifs, one per journal */
export function drawMotif(g: CanvasRenderingContext2D, motif: Motif, colour: string, w: number, h: number) {
  g.save();
  g.strokeStyle = colour;
  g.fillStyle = colour;
  g.lineWidth = Math.max(3, w * 0.004);
  g.globalAlpha = 0.88;
  const cx = w * 0.5;
  const cy = h * 0.38;
  const r = Math.min(w, h) * 0.22;
  if (motif === "brackets") {
    for (let d = 0; d < 3; d += 1) {
      const s = d * r * 0.22;
      const l = cx - r + s;
      const rt = cx + r - s;
      const t = cy - r * 0.72 + s;
      const b = cy + r * 0.72 - s;
      g.beginPath();
      g.moveTo(l + r * 0.25, t);
      g.lineTo(l, t);
      g.lineTo(l, b);
      g.lineTo(l + r * 0.25, b);
      g.moveTo(rt - r * 0.25, t);
      g.lineTo(rt, t);
      g.lineTo(rt, b);
      g.lineTo(rt - r * 0.25, b);
      g.stroke();
    }
    g.fillRect(cx - 3, cy - 3, 6, 6);
  } else if (motif === "paths") {
    g.beginPath();
    g.moveTo(cx - r, cy + r * 0.35);
    g.bezierCurveTo(cx - r * 0.2, cy - r, cx + r * 0.1, cy + r, cx + r, cy - r * 0.25);
    g.stroke();
    g.globalAlpha = 0.52;
    g.beginPath();
    g.moveTo(cx - r, cy - r * 0.45);
    g.bezierCurveTo(cx - r * 0.25, cy + r, cx + r * 0.3, cy - r, cx + r, cy + r * 0.45);
    g.stroke();
    for (let d = -1; d <= 1; d += 1) {
      g.beginPath();
      g.arc(cx + d * r, cy - d * r * 0.25, 7, 0, Math.PI * 2);
      g.fill();
    }
  } else if (motif === "orbits") {
    g.beginPath();
    g.ellipse(cx, cy, r, r * 0.42, -0.35, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 0.58;
    g.beginPath();
    g.ellipse(cx, cy, r * 0.72, r, 0.52, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 0.9;
    g.beginPath();
    g.arc(cx + r * 0.64, cy - r * 0.34, 8, 0, Math.PI * 2);
    g.fill();
    g.fillRect(cx - 6, cy - 6, 12, 12);
  } else if (motif === "modules") {
    const d = r * 0.54;
    const cells: [number, number, "circle" | "rect"][] = [
      [-0.55, -0.5, "circle"],
      [0.25, -0.5, "rect"],
      [-0.55, 0.3, "rect"],
      [0.25, 0.3, "circle"],
    ];
    cells.forEach(([x, y, kind], i) => {
      g.globalAlpha = 0.45 + i * 0.12;
      if (kind === "circle") {
        g.beginPath();
        g.arc(cx + x * r, cy + y * r, d * 0.48, 0, Math.PI * 2);
        g.stroke();
      } else {
        g.strokeRect(cx + x * r - d * 0.5, cy + y * r - d * 0.5, d, d);
      }
    });
  } else if (motif === "frames") {
    for (let d = 0; d < 4; d += 1) {
      g.globalAlpha = 0.9 - d * 0.17;
      const s = d * r * 0.18;
      g.strokeRect(cx - r + s, cy - r * 0.7 + s, r * 2 - s * 2, r * 1.4 - s * 2);
    }
    g.beginPath();
    g.moveTo(cx - r, cy - r * 0.7);
    g.lineTo(cx + r, cy + r * 0.7);
    g.stroke();
  } else {
    g.beginPath();
    g.arc(cx, cy, r * 0.78, 0.15, Math.PI * 1.82);
    g.stroke();
    g.beginPath();
    g.moveTo(cx - r * 0.72, cy + r * 0.88);
    g.lineTo(cx, cy - r * 0.92);
    g.lineTo(cx + r * 0.72, cy + r * 0.88);
    g.stroke();
    g.globalAlpha = 0.48;
    g.beginPath();
    g.moveTo(cx - r, cy);
    g.lineTo(cx + r, cy);
    g.stroke();
  }
  g.restore();
}

/** Cloth with its grain, the edges darkened where the boards turn: the front, back and spine share it */
function clothGround(g: CanvasRenderingContext2D, look: Look, w: number, h: number, salt: string, strokes: number, vertical = false) {
  const rand = rng(look, salt);
  g.fillStyle = look.cloth;
  g.fillRect(0, 0, w, h);
  const shade = g.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, "rgba(0,0,0,0.22)");
  shade.addColorStop(0.07, "rgba(255,255,255,0.035)");
  shade.addColorStop(0.5, "rgba(255,255,255,0.01)");
  shade.addColorStop(0.94, "rgba(0,0,0,0.06)");
  shade.addColorStop(1, "rgba(0,0,0,0.18)");
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < strokes; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const along = vertical && rand() > 0.42;
    g.strokeStyle = rand() > 0.5 ? `rgba(255,255,255,${0.018 + rand() * 0.034})` : `rgba(0,0,0,${0.018 + rand() * 0.03})`;
    g.lineWidth = 0.45 + rand() * 0.75;
    g.beginPath();
    g.moveTo(x, y);
    if (along) g.lineTo(x + (rand() - 0.5) * 1.2, y + 8 + rand() * 34);
    else g.lineTo(x + 5 + rand() * 26, y + (rand() - 0.5) * 1.6);
    g.stroke();
  }
}

/** Front board: the journal's cloth with its mark pressed in faintly. The type is foil, on its own layer */
export function paintCover(look: Look, w: number, h: number) {
  const [c, g] = canvas2d(w, h);
  clothGround(g, look, w, h, "cover", Math.round(1250 * ((w * h) / (768 * 1152))));
  g.save();
  g.globalAlpha = 0.16;
  drawMotif(g, look.motif, "rgba(0,0,0,0.9)", w, h);
  g.restore();
  return c;
}

/**
 * The front's foil in white on clear (the material tints it): a double frame, the eyebrow
 * with the volume's numeral, the journal's name and its few words. Laid out like the original's
 * foil, on a 768 × 1152 page scaled to the canvas.
 */
export function paintFrontFoil(look: Look, fonts: Fonts, w: number, h: number) {
  const [c, g] = canvas2d(w, h);
  const k = w / 768;
  g.scale(k, k);
  const W = 768;
  const H = 1152;
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#ffffff";
  g.lineWidth = 2;
  g.globalAlpha = 0.72;
  g.strokeRect(42, 42, W - 84, H - 84);
  g.strokeRect(55, 55, W - 110, H - 110);
  g.globalAlpha = 1;
  drawMotif(g, look.motif, "#ffffff", W, H);
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.font = `500 17px ${fonts.mono}`;
  spaced(g, 3);
  g.fillText(`NOTEBOOK  /  ${look.vol.roman}`, 92, 118);
  g.globalAlpha = 0.7;
  g.fillRect(92, 136, 120, 2);
  g.globalAlpha = 1;
  const size = look.vol.title.length > 10 ? 84 : 100;
  g.font = `400 ${size}px ${fonts.serif}`;
  spaced(g, 0);
  g.fillText(look.vol.title, 90, 960);
  g.font = `500 16px ${fonts.mono}`;
  spaced(g, 2.6);
  g.fillText(look.vol.short.toUpperCase(), 94, 1012);
  return c;
}

/** A plain weave in grey, for the cloth's bump */
export function paintWeave(look: Look) {
  const [c, g] = canvas2d(256, 256);
  const rand = rng(look, "cloth");
  g.fillStyle = "#7f7f7f";
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const v = Math.round(98 + rand() * 70);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.globalAlpha = 0.34 + rand() * 0.18;
    g.lineWidth = 0.65 + rand() * 0.45;
    g.beginPath();
    g.moveTo(0, y + (rand() - 0.5));
    g.lineTo(256, y + (rand() - 0.5));
    g.stroke();
  }
  for (let x = 1; x < 256; x += 3) {
    const v = Math.round(105 + rand() * 58);
    g.strokeStyle = `rgb(${v},${v},${v})`;
    g.globalAlpha = 0.25 + rand() * 0.14;
    g.lineWidth = 0.55 + rand() * 0.35;
    g.beginPath();
    g.moveTo(x + (rand() - 0.5), 0);
    g.lineTo(x + (rand() - 0.5), 256);
    g.stroke();
  }
  return c;
}

/** The weave as a height field, written out as a normal map and a roughness map */
export function paintClothMaps(look: Look) {
  const height = new Float32Array(256 * 256);
  const [normal, gn] = canvas2d(256, 256);
  const [rough, gr] = canvas2d(256, 256);
  const nd = gn.createImageData(256, 256);
  const rd = gr.createImageData(256, 256);
  const s = (look.seed % 19) * 0.23;
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const a = Math.sin((x + s) * Math.PI * 0.52);
      const b = Math.sin((y - s) * Math.PI * 0.41);
      const d = Math.sin((x + y + s) * Math.PI * 0.19);
      height[y * 256 + x] = 0.5 + a * 0.18 + b * 0.15 + d * 0.045;
    }
  }
  const at = (x: number, y: number) => height[((y + 256) % 256) * 256 + ((x + 256) % 256)];
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const i = y * 256 + x;
      const o = i * 4;
      const dx = (at(x + 1, y) - at(x - 1, y)) * 1.5;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 1.5;
      const len = Math.hypot(dx, dy, 1);
      nd.data[o] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      nd.data[o + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      nd.data[o + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      nd.data[o + 3] = 255;
      const v = Math.round(188 + height[i] * 56);
      rd.data[o] = v;
      rd.data[o + 1] = v;
      rd.data[o + 2] = v;
      rd.data[o + 3] = 255;
    }
  }
  gn.putImageData(nd, 0, 0);
  gr.putImageData(rd, 0, 0);
  return { normal, rough };
}

/** Paper stock: a warm ground, fibres both ways, a little speckle */
export function paperGround(g: CanvasRenderingContext2D, w: number, h: number, rand: () => number, paper: string) {
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  const light = g.createLinearGradient(0, 0, w, h);
  light.addColorStop(0, "rgba(255,255,255,0.22)");
  light.addColorStop(0.42, "rgba(255,255,255,0.035)");
  light.addColorStop(1, "rgba(103,87,64,0.08)");
  g.fillStyle = light;
  g.fillRect(0, 0, w, h);
  const fibres = Math.round(2400 * ((w * h) / (768 * 1152)));
  for (let i = 0; i < fibres; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 5 + rand() * 34;
    g.strokeStyle = rand() > 0.44 ? `rgba(255,255,255,${0.025 + rand() * 0.045})` : `rgba(92,76,55,${0.018 + rand() * 0.035})`;
    g.lineWidth = 0.45 + rand() * 0.65;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(Math.min(w, x + len), y + (rand() - 0.5) * 2.2);
    g.stroke();
  }
  for (let i = 0; i < fibres / 2; i += 1) {
    const v = Math.round(112 + rand() * 94);
    g.fillStyle = `rgba(${v},${v - 5},${v - 13},${0.016 + rand() * 0.025})`;
    const s = 0.5 + rand() * 1.1;
    g.fillRect(rand() * w, rand() * h, s, s);
  }
}

/** Unprinted paper, shared by every page block */
export function paintPaper(w: number, h: number, paper: string) {
  const [c, g] = canvas2d(w, h);
  paperGround(g, w, h, seeded(hash("hayzaydee-notebook-paper")), paper);
  return c;
}

/** Words on lines no longer than `chars`, at most `lines` of them; returns the lines used */
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, chars: number, leading: number, lines = 6) {
  const words = text.split(/\s+/);
  let line = "";
  let n = 0;
  for (const word of words) {
    if (n >= lines) break;
    const next = line ? `${line} ${word}` : word;
    if (next.length > chars && line) {
      // The last line that fits takes an ellipsis when words remain
      g.fillText(n === lines - 1 ? `${line}…` : line, x, y + n * leading);
      line = word;
      n += 1;
    } else {
      line = next;
    }
  }
  if (line && n < lines) {
    g.fillText(line, x, y + n * leading);
    n += 1;
  }
  return n;
}

/** Inside the boards: paper washed with the cloth colour, a fine foil grid and the mark */
export function paintEndpaper(look: Look) {
  const [c, g] = canvas2d(512, 768);
  paperGround(g, 512, 768, rng(look, "endpaper"), look.paper);
  g.save();
  g.fillStyle = look.cloth;
  g.globalAlpha = 0.14;
  g.fillRect(0, 0, 512, 768);
  g.globalAlpha = 0.18;
  g.strokeStyle = look.foil;
  g.lineWidth = 1;
  for (let x = 28; x < 512; x += 48) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 768);
    g.stroke();
  }
  for (let y = 24; y < 768; y += 48) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  g.globalAlpha = 0.42;
  drawMotif(g, look.motif, look.ink, 512, 768);
  g.restore();
  return c;
}

/**
 * The eight printed faces of a volume's four leaves, in reading order: the title page, one
 * entry per face (its number, title, date and reading time, then ruled lines to write on),
 * and the colophon. A journal with fewer entries leaves its remaining pages ruled and blank.
 */
export function paintLeaves(look: Look, fonts: Fonts) {
  const W = 512;
  const H = 768;
  const { vol } = look;
  return Array.from({ length: 8 }, (_, face) => {
    // Full size: only a volume that's taken down paints its leaves, and they fill the view
    const [c, g] = canvas2d(W, H);
    const rand = rng(look, `leaf-${face}`);
    paperGround(g, W, H, rand, look.paper);
    g.fillStyle = look.ink;
    g.strokeStyle = look.ink;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";

    // Running head and folio
    g.globalAlpha = 0.58;
    g.font = `500 10px ${fonts.mono}`;
    spaced(g, 1.8);
    g.fillText(`NOTEBOOK  /  ${vol.title.toUpperCase()}`, 48, 48);
    g.textAlign = "right";
    g.fillText(String(face + 1).padStart(2, "0"), W - 48, 48);
    g.textAlign = "left";
    g.fillRect(48, 64, W - 96, 1);
    g.globalAlpha = 1;

    const entry = face >= 1 && face <= 6 ? vol.entries[face - 1] : undefined;
    if (face === 0) {
      g.font = `500 12px ${fonts.mono}`;
      spaced(g, 2.3);
      g.fillText(`VOLUME ${vol.roman}`, 54, 174);
      g.font = `400 ${vol.title.length > 10 ? 52 : 62}px ${fonts.serif}`;
      spaced(g, 0);
      wrap(g, vol.title, 52, 250, 16, 60, 2);
      g.globalAlpha = 0.6;
      g.font = `400 24px ${fonts.serif}`;
      wrap(g, vol.short, 54, 330, 34, 30, 2);
      g.globalAlpha = 0.5;
      g.font = `500 11px ${fonts.mono}`;
      spaced(g, 2);
      g.fillText(vol.countLabel.toUpperCase(), 54, 470);
      if (vol.since) g.fillText(vol.since.toUpperCase(), 54, 494);
      g.globalAlpha = 0.5;
      drawMotif(g, look.motif, look.ink, W, H * 1.55);
    } else if (face === 7) {
      g.font = `500 11px ${fonts.mono}`;
      spaced(g, 2);
      g.fillText("COLOPHON", 54, 164);
      g.font = `400 34px ${fonts.serif}`;
      spaced(g, 0);
      g.fillText(vol.title, 54, 230);
      g.globalAlpha = 0.6;
      g.font = `400 19px ${fonts.serif}`;
      const lead = vol.since ? `${vol.countLabel}, ${vol.since}.` : `${vol.countLabel}.`;
      wrap(g, `${lead} Kept by hand at hayzaydee.me; the newest entries are printed in the pages before this one.`, 54, 306, 42, 28, 7);
      g.globalAlpha = 0.74;
      g.font = `500 10px ${fonts.mono}`;
      spaced(g, 1.8);
      g.fillText(`VOLUME ${vol.roman}  ·  HAYZAYDEE`, 54, 676);
    } else if (entry) {
      g.font = `500 11px ${fonts.mono}`;
      spaced(g, 2);
      g.fillText(`ENTRY ${String(face).padStart(2, "0")}`, 54, 150);
      g.font = entry.untitled ? `italic 400 30px ${fonts.serif}` : `400 40px ${fonts.serif}`;
      spaced(g, 0);
      const used = entry.untitled ? wrap(g, entry.title, 52, 222, 30, 38, 4) : wrap(g, entry.title, 52, 222, 20, 46, 4);
      const below = 222 + used * (entry.untitled ? 38 : 46) + 22;
      g.globalAlpha = 0.6;
      g.font = `400 20px ${fonts.script}`;
      g.fillText(entry.date, 54, below);
      if (entry.readTime) {
        g.font = `500 10px ${fonts.mono}`;
        spaced(g, 1.6);
        g.fillText(entry.readTime.toUpperCase(), 54, below + 30);
      }
      // Ruled lines below, faint, for the rest of the page
      g.globalAlpha = 0.16;
      for (let y = below + 70; y < H - 80; y += 26) g.fillRect(54, y, W - 108, 1);
    } else {
      g.globalAlpha = 0.14;
      for (let y = 140; y < H - 80; y += 26) g.fillRect(54, y, W - 108, 1);
    }
    g.globalAlpha = 0.62;
    g.fillRect(48, H - 48, W - 96, 1);
    g.globalAlpha = 1;
    return c;
  });
}

/** A soft elliptical shadow, white for an alpha map */
export function paintContactShadow() {
  const [c, g] = canvas2d(512, 128);
  const r = g.createRadialGradient(256, 64, 10, 256, 64, 254);
  r.addColorStop(0, "rgba(255,255,255,0.95)");
  r.addColorStop(0.38, "rgba(255,255,255,0.62)");
  r.addColorStop(0.72, "rgba(255,255,255,0.18)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 512, 128);
  return c;
}

/** The page block's cut edges: fine lines of stacked paper, the fore-edge a little coarser */
export function paintEdge(w: number, h: number, kind: "fore" | "head", paper: string) {
  const [c, g] = canvas2d(w, h);
  const rand = seeded(hash(`notebook-${kind}-edge`));
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  const step = kind === "fore" ? 2 : 1.35;
  for (let y = 0; y < h; y += step) {
    const v = Math.round(106 + rand() * 74);
    const dark = rand() > 0.965;
    g.strokeStyle = `rgba(${v},${v - 3},${v - 9},${dark ? 0.34 : 0.13 + rand() * 0.13})`;
    g.lineWidth = dark ? 1.05 : 0.42 + rand() * 0.42;
    g.beginPath();
    g.moveTo(0, y + (rand() - 0.5) * 0.5);
    g.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 0.9, w * 0.72, y + (rand() - 0.5) * 0.9, w, y + (rand() - 0.5) * 0.5);
    g.stroke();
  }
  const shade = g.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, "rgba(58,48,35,0.18)");
  shade.addColorStop(0.035, "rgba(255,255,255,0.04)");
  shade.addColorStop(0.86, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(58,48,35,0.12)");
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  return c;
}

export function paintSpine(look: Look) {
  const [c, g] = canvas2d(256, 1024);
  clothGround(g, look, 256, 1024, "spine", 1300, true);
  const foot = g.createLinearGradient(0, 1024 * 0.82, 0, 1024);
  foot.addColorStop(0, "rgba(0,0,0,0)");
  foot.addColorStop(1, "rgba(0,0,0,0.12)");
  g.fillStyle = foot;
  g.fillRect(0, 0, 256, 1024);
  return c;
}

/** The spine's foil: a frame, the numeral at the head, the name running up, a small seal at the foot */
export function paintSpineFoil(look: Look, fonts: Fonts) {
  const W = 384;
  const H = 1536;
  const [c, g] = canvas2d(256, 1024);
  g.scale(256 / W, 1024 / H);
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#ffffff";
  g.lineWidth = 2.4;
  g.strokeRect(34, 38, W - 68, H - 76);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `500 26px ${fonts.mono}`;
  spaced(g, 5);
  g.fillText(look.vol.roman, W * 0.5, 118);
  g.save();
  g.translate(W * 0.5, H * 0.5);
  g.rotate(Math.PI / 2);
  g.font = `400 ${look.vol.title.length > 10 ? 74 : 86}px ${fonts.serif}`;
  spaced(g, 0);
  g.fillText(look.vol.title, 0, 0);
  g.restore();
  g.beginPath();
  g.arc(W * 0.5, H - 120, 24, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(W * 0.5 - 24, H - 120);
  g.lineTo(W * 0.5 + 24, H - 120);
  g.stroke();
  return c;
}

export function paintBack(look: Look, w: number, h: number) {
  const [c, g] = canvas2d(w, h);
  clothGround(g, look, w, h, "back", Math.round(2600 * ((w * h) / (768 * 1152))));
  const glow = g.createRadialGradient(w * 0.62, h * 0.38, 20, w * 0.62, h * 0.38, w * 0.75);
  glow.addColorStop(0, "rgba(255,255,255,0.03)");
  glow.addColorStop(1, "rgba(0,0,0,0.09)");
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  return c;
}

/** The back board's foil: the eyebrow, five rings round a cross, the name and the site */
export function paintBackFoil(look: Look, fonts: Fonts, w: number, h: number) {
  const [c, g] = canvas2d(w, h);
  g.scale(w / 768, w / 768);
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#ffffff";
  g.textAlign = "left";
  g.textBaseline = "alphabetic";
  g.font = `500 16px ${fonts.mono}`;
  spaced(g, 3);
  g.fillText(`NOTEBOOK  /  ${look.vol.roman}`, 68, 82);
  g.globalAlpha = 0.72;
  g.fillRect(68, 108, 176, 2);
  g.globalAlpha = 1;
  g.lineWidth = 1.5;
  for (let r = 0; r < 5; r += 1) {
    g.globalAlpha = 0.24 - r * 0.032;
    g.beginPath();
    g.arc(548, 374, 74 + r * 38, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.beginPath();
  g.moveTo(348, 374);
  g.lineTo(704, 374);
  g.moveTo(548, 174);
  g.lineTo(548, 574);
  g.stroke();
  g.font = `400 ${look.vol.title.length > 10 ? 58 : 68}px ${fonts.serif}`;
  spaced(g, 0);
  g.fillText(look.vol.title, 68, 956);
  g.font = `500 15px ${fonts.mono}`;
  spaced(g, 2.6);
  g.fillText(look.vol.short.toUpperCase(), 70, 1004);
  g.globalAlpha = 0.68;
  g.fillRect(68, 1040, 632, 1.5);
  g.globalAlpha = 1;
  g.textAlign = "right";
  g.fillText("HAYZAYDEE.ME", 700, 1080);
  return c;
}

/**
 * Walnut for the shelf. The original shipped a photographed board; this grows one: long
 * wavering grain lines over a two-tone ground, with a few darker figure streaks, in grey so
 * the material's colour tints it (the shelf follows the room).
 */
export function paintWalnut() {
  const [c, g] = canvas2d(1024, 256);
  const rand = seeded(hash("hayzaydee-walnut"));
  const ground = g.createLinearGradient(0, 0, 0, 256);
  ground.addColorStop(0, "#c9c9c9");
  ground.addColorStop(0.5, "#e2e2e2");
  ground.addColorStop(1, "#c4c4c4");
  g.fillStyle = ground;
  g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 140; i += 1) {
    const y0 = rand() * 256;
    const amp = 2 + rand() * 7;
    const freq = 0.004 + rand() * 0.01;
    const phase = rand() * Math.PI * 2;
    const dark = rand() > 0.82;
    g.strokeStyle = dark ? `rgba(40,40,40,${0.16 + rand() * 0.18})` : `rgba(90,90,90,${0.08 + rand() * 0.12})`;
    g.lineWidth = dark ? 1.2 + rand() * 1.8 : 0.5 + rand() * 0.9;
    g.beginPath();
    for (let x = 0; x <= 1024; x += 16) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.25;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}

import type { Journal } from "@/lib/notebook/journals";

/** The six marks from ThreeUI's Bookshelf covers, one per journal: on its volume's boards and its noren */
export type Motif = "paths" | "modules" | "frames" | "orbits" | "brackets" | "bowl";

export const JOURNAL_MOTIFS: Record<Journal, Motif> = {
  reflections: "paths",
  fragments: "modules",
  annotations: "frames",
  responses: "orbits",
  buildlog: "brackets",
  cookbook: "bowl",
};

export const MOTIF_ORDER: Motif[] = ["paths", "modules", "frames", "orbits", "brackets", "bowl"];

/** A journal's mark, centred at (w/2, 0.38h) with radius 0.22 of the shorter side, as the covers place it */
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


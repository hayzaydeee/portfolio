import type { FxContext, FxInstance, RGB, RoomKey, RoomPalette } from "@/components/fx/runtime/types";
import { createProgram, FULLSCREEN_VERTEX, getGL } from "@/components/fx/runtime/gl";
import { getRoomPalette } from "@/components/fx/runtime/palette";
import { loadFont } from "@/components/fx/runtime/fonts";
import {
  easeInCubic,
  easeInOutCubic,
  easeOutCubic,
  isPortalPhase,
  phaseProgress,
  type PortalPhaseCommand,
} from "@/components/fx/effects/portal-timeline";
import { FILL_FRAGMENT, GLYPH_FRAGMENT, GLYPH_VERTEX, MAX_RINGS } from "./shaders";
import type { GlyphVortexOptions } from "./meta";

/**
 * Adapted from ThreeUI Typography Vortex (MIT, Meng To): seeded concentric glyph rings with
 * per-ring speed, wobble and sparse every-third rings. Re-authored for transitions: the
 * phrase is the destination room, the background is transparent, and the rings are drawn
 * in WebGL from a glyph atlas instead of canvas 2D.
 */

const PHRASES: Record<RoomKey, string> = {
  lobby: "HAYZAYDEE / THE LOBBY / ",
  workshop: "WORKSHOP / ~/WORK / ",
  studio: "STUDIO / MUSIC / ",
  notebook: "NOTEBOOK / JOURNAL / ",
  wall: "THE WALL / ART / ",
};

const FONT = '"Google Sans Code", ui-monospace, "SFMono-Regular", Menlo, monospace';
const ATLAS_FONT_PX = 44;
const CELL_PX = 64;
const ATLAS_COLS = 8;
const SOURCE_GLYPH: RGB = [211 / 255, 211 / 255, 206 / 255];
const SOURCE_VOID: RGB = [0.082, 0.082, 0.082];
/** Floats per vertex: corner xy, glyph angle, ring index, atlas cell origin uv */
const STRIDE = 6;
const QUAD: readonly [number, number][] = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [-0.5, 0.5],
  [-0.5, 0.5],
  [0.5, -0.5],
  [0.5, 0.5],
];

type Ring = { radius: number; fontSize: number; alpha: number; speed: number; offset: number; wobble: number };

/** mulberry32, the original's seeded generator, so rings land the same on every visit */
function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let v = Math.imul(s ^ (s >>> 15), 1 | s);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

export function create(ctx: FxContext, initial: GlyphVortexOptions): FxInstance<GlyphVortexOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const gl = getGL(canvas, { alpha: true, premultipliedAlpha: true });
  if (!gl) throw new Error("WebGL unavailable");

  const glyphs = createProgram(gl, GLYPH_VERTEX, GLYPH_FRAGMENT);
  const fill = createProgram(gl, FULLSCREEN_VERTEX, FILL_FRAGMENT);
  const fillBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fillBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const glyphBuffer = gl.createBuffer();
  const texture = gl.createTexture();
  gl.enable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);

  const fillPosition = gl.getAttribLocation(fill.program, "position");
  const glyphAttrs = (
    [
      ["aCorner", 2, 0],
      ["aAngle", 1, 2],
      ["aRing", 1, 3],
      ["aCell", 2, 4],
    ] as const
  ).map(([name, size, offset]) => ({ loc: gl.getAttribLocation(glyphs.program, name), size, offset }));

  let w = 1;
  let h = 1;
  let dpr = 1;
  let rings: Ring[] = [];
  let vertexCount = 0;
  let geometryKey = "";
  let atlasKey = "";
  let cells = new Map<string, number>();
  let cellUV: [number, number] = [0, 0];
  const ringData = new Float32Array(MAX_RINGS * 4);

  let cmd: PortalPhaseCommand | null = null;
  let demo: { at: number; to: RoomKey } | null = null;
  let elapsed = 0;
  let still = false;
  let fontReady = false;

  const paletteFor = (room: RoomKey | null): RoomPalette =>
    !room || room === ctx.palette.room ? ctx.palette : getRoomPalette(room);

  const buildAtlas = (phrase: string) => {
    const key = `${phrase}|${fontReady}`;
    if (key === atlasKey) return;
    atlasKey = key;
    const chars = [...new Set(phrase)].filter((c) => c !== " ");
    const atlas = document.createElement("canvas");
    atlas.width = nextPow2(ATLAS_COLS * CELL_PX);
    atlas.height = nextPow2(Math.ceil(chars.length / ATLAS_COLS) * CELL_PX);
    const g = atlas.getContext("2d");
    if (!g) return;
    g.font = `${ATLAS_FONT_PX}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#fff";
    cells = new Map();
    chars.forEach((char, i) => {
      const col = i % ATLAS_COLS;
      const row = Math.floor(i / ATLAS_COLS);
      g.fillText(char, col * CELL_PX + CELL_PX / 2, row * CELL_PX + CELL_PX / 2);
      cells.set(char, i);
    });
    cellUV = [CELL_PX / atlas.width, CELL_PX / atlas.height];
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    // Power-of-two atlas so small outer-ring sizes minify through mips instead of shimmering
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };

  const buildGeometry = (phrase: string) => {
    const key = `${phrase}|${w}|${h}|${opts.ringGrowth}|${atlasKey}`;
    if (key === geometryKey) return;
    geometryKey = key;
    const rand = seeded(122);
    const reach = Math.hypot(w * 0.55, h * 0.52) + 40;
    const verts: number[] = [];
    rings = [];
    let radius = Math.max(26, w * 0.038);
    for (let i = 0; radius < reach && i < MAX_RINGS; i++) {
      const sparse = i % 3 === 2;
      const fontSize = clamp(7 + radius * 0.015, 7, 17);
      const spacing = sparse ? 2.4 + rand() * 1.2 : 1.02 + rand() * 0.14;
      const fit = Math.max(4, Math.floor((Math.PI * 2) / ((fontSize * 0.62 * spacing) / radius)));
      // Whole phrases per ring, so the text doesn't stutter where the ring closes
      const count = fit >= phrase.length ? fit - (fit % phrase.length) : fit;
      rings.push({
        radius,
        fontSize,
        alpha: clamp(0.34 + radius / reach, 0.36, 0.92) * (sparse ? 0.72 : 1),
        speed: (0.05 + 40 / (radius + 60)) * 0.35,
        offset: rand() * Math.PI * 2,
        wobble: rand() * Math.PI * 2,
      });
      for (let k = 0; k < count; k++) {
        const cell = cells.get(phrase[k % phrase.length]);
        if (cell === undefined) continue;
        const angle = (k * Math.PI * 2) / count;
        const u = (cell % ATLAS_COLS) * cellUV[0];
        const v = Math.floor(cell / ATLAS_COLS) * cellUV[1];
        for (const [cx, cy] of QUAD) verts.push(cx, cy, angle, i, u, v);
      }
      radius *= Math.max(1.12, opts.ringGrowth);
    }
    vertexCount = verts.length / STRIDE;
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
  };

  const demoPhase = (now: number): PortalPhaseCommand | null => {
    if (!demo) return null;
    const t = now - demo.at;
    const base = { from: ctx.palette.room, to: demo.to };
    if (t < 560) return { ...base, name: "cover", at: demo.at, ms: 560 };
    if (t < 1100) return { ...base, name: "hold", at: demo.at + 560, ms: 540 };
    if (t < 1620) return { ...base, name: "reveal", at: demo.at + 1100, ms: 520 };
    demo = null;
    return null;
  };

  /** Mode 0 lays the void (premultiplied source-over); mode 1 scales what's drawn by (1 - hole mask) */
  const drawFill = (mode: 0 | 1, voidColor: RGB, voidAlpha: number, hole: number) => {
    gl.useProgram(fill.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, fillBuffer);
    gl.enableVertexAttribArray(fillPosition);
    gl.vertexAttribPointer(fillPosition, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(fill.uniform("uRes"), canvas.width, canvas.height);
    gl.uniform2f(fill.uniform("uCenter"), (w / 2) * dpr, (h / 2) * dpr);
    gl.uniform3fv(fill.uniform("uVoid"), voidColor);
    gl.uniform1f(fill.uniform("uVoidAlpha"), voidAlpha);
    gl.uniform1f(fill.uniform("uHole"), hole * dpr);
    gl.uniform1f(fill.uniform("uMode"), mode);
    if (mode === 0) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(fillPosition);
  };

  const drawRings = (scale: number, alpha: number, spin: number, color: RGB) => {
    if (alpha <= 0.002 || vertexCount === 0) return;
    const t = elapsed * opts.speed;
    rings.forEach((ring, i) => {
      ringData[i * 4] = ring.radius;
      ringData[i * 4 + 1] = ring.fontSize;
      ringData[i * 4 + 2] = ring.offset + t * ring.speed + Math.sin(t * 0.11 + ring.wobble) * 0.02 + spin;
      ringData[i * 4 + 3] = ring.alpha * alpha * opts.opacity;
    });
    gl.useProgram(glyphs.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, glyphBuffer);
    for (const { loc, size, offset } of glyphAttrs) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(glyphs.uniform("uAtlas"), 0);
    gl.uniform2f(glyphs.uniform("uRes"), w, h);
    gl.uniform2f(glyphs.uniform("uCenter"), w / 2, h / 2);
    gl.uniform1f(glyphs.uniform("uScale"), scale);
    // A cell is CELL_PX for an ATLAS_FONT_PX glyph; the shader's 1.3 assumes a 1.3em cell
    gl.uniform1f(glyphs.uniform("uSizeScale"), (Math.min(scale, 1.6) * CELL_PX) / ATLAS_FONT_PX / 1.3);
    gl.uniform2fv(glyphs.uniform("uCellSize"), cellUV);
    gl.uniform4fv(glyphs.uniform("uRing"), ringData);
    gl.uniform3fv(glyphs.uniform("uColor"), color);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    for (const { loc } of glyphAttrs) gl.disableVertexAttribArray(loc);
  };

  const draw = (now: number) => {
    const active = demoPhase(now) ?? cmd;
    const to = paletteFor(active?.to ?? null);
    const phrase = PHRASES[active?.to ?? ctx.palette.room];
    const glyphColor = opts.sourcePalette ? SOURCE_GLYPH : to.text;
    const voidColor = opts.sourcePalette ? SOURCE_VOID : to.base;
    buildAtlas(phrase);
    buildGeometry(phrase);

    const p = phaseProgress(active, now);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (!active) {
      // Lab preview with no trip running
      drawRings(1, 0.75, 0, glyphColor);
    } else if (active.name === "cover") {
      drawFill(0, voidColor, clamp(p * 1.25, 0, 1), 0);
      const e = easeOutCubic(p);
      drawRings(2.4 - 1.4 * e, p, (1 - e) * 2.2, glyphColor);
    } else if (active.name === "hold") {
      drawFill(0, voidColor, 1, 0);
      drawRings(1, 1, 0, glyphColor);
    } else if (p < 1) {
      // Reveal: glyphs scatter outward while a soft hole opens the new room from the centre
      drawFill(0, voidColor, 1, 0);
      drawRings(1 + 1.4 * easeInCubic(p), 1 - p, 0, glyphColor);
      const hole = easeInOutCubic(p) * Math.hypot(w, h) * 0.72;
      if (hole > 1) drawFill(1, voidColor, 0, hole);
    }
    // a finished reveal stays transparent until the host unmounts the stage
  };

  const ready = loadFont(400, ATLAS_FONT_PX, FONT).then(() => {
    fontReady = true;
  });

  return {
    ready,

    resize(cssW, cssH, pr) {
      w = Math.max(1, cssW);
      h = Math.max(1, cssH);
      dpr = pr;
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (still) draw(performance.now());
    },

    render(now, dt) {
      elapsed += dt / 1000;
      draw(now);
    },

    update(next) {
      opts = { ...opts, ...next };
      if (still) draw(performance.now());
    },

    still() {
      still = true;
      elapsed = 4;
      draw(performance.now());
    },

    command(name, arg) {
      if (name === "phase" && isPortalPhase(arg)) cmd = arg;
      else if (name === "demo") demo = { at: performance.now(), to: (arg as RoomKey) ?? "studio" };
      if (still) draw(performance.now());
    },

    dispose() {
      gl.deleteBuffer(glyphBuffer);
      gl.deleteBuffer(fillBuffer);
      gl.deleteTexture(texture);
      glyphs.dispose();
      fill.dispose();
    },
  };
}

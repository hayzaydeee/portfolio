import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { createProgram, getGL } from "@/components/fx/runtime/gl";
import { mixRGB, resolveToken } from "@/components/fx/runtime/palette";
import { resolveFontFamily } from "@/components/fx/runtime/fonts";
import { compose, perspective, type Mat4 } from "@/components/fx/runtime/mat4";
import type { WarpFieldOptions } from "./meta";

/**
 * Port of ThreeUI's Warp Field in its "letters" variant (MIT, Meng To) from three r128 to raw
 * WebGL. Same scene: a perspective camera at the origin looking down -z, 400 streak segments
 * in a ring of radius 20 to 820 flying toward it and recycling at z 200, and 260 glyph tiles
 * spinning and swaying through them, all under exponential fog. The glyphs come from the
 * project's own name, and the colours from its accent and the room.
 */

const STREAKS = 400;
const TILES = 260;
const NEAR_Z = 200;
const FAR_Z = -1800;
const TILE_NEAR = 140;
const TILE_FAR = -1300;
const FOG = 0.001;
const ATLAS_CELL = 128;
const ATLAS_COLS = 6;
const FALLBACK = "HZYWORKSHOP";

const LINE_VS = `
attribute vec3 a_pos;
attribute vec3 a_col;
uniform mat4 u_proj;
uniform float u_fog;
varying vec3 v_col;
varying float v_fog;
void main() {
  gl_Position = u_proj * vec4(a_pos, 1.0);
  float d = -a_pos.z;
  v_fog = exp(-(u_fog * d) * (u_fog * d));
  v_col = a_col;
}`;

const LINE_FS = `
precision mediump float;
uniform float u_opacity;
varying vec3 v_col;
varying float v_fog;
void main() { gl_FragColor = vec4(v_col * u_opacity * v_fog, 1.0); }`;

const TILE_VS = `
attribute vec3 a_pos;
attribute vec2 a_uv;
attribute vec3 a_col;
uniform mat4 u_proj;
uniform float u_fog;
varying vec2 v_uv;
varying vec3 v_col;
varying float v_fog;
void main() {
  gl_Position = u_proj * vec4(a_pos, 1.0);
  float d = -a_pos.z;
  v_fog = exp(-(u_fog * d) * (u_fog * d));
  v_uv = a_uv;
  v_col = a_col;
}`;

const TILE_FS = `
precision mediump float;
uniform sampler2D u_atlas;
uniform float u_opacity;
varying vec2 v_uv;
varying vec3 v_col;
varying float v_fog;
void main() {
  float a = texture2D(u_atlas, v_uv).a * u_opacity * v_fog;
  gl_FragColor = vec4(v_col * a, a);
}`;

const hex = (n: number): RGB => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const SOURCE = {
  bg: hex(0x02040a),
  streaks: [0x10b981, 0x059669, 0x34d399, 0xffffff].map(hex),
  tiles: [0xffffff, 0xa7f3d0, 0x34d399].map(hex),
};

type Tile = { x: number; y: number; z: number; scale: number; rx: number; ry: number; rz: number; spin: number; swayX: number; swayY: number; phase: number; drift: number; glyph: number; col: RGB };

function glyphsFrom(text: string): string[] {
  const chars = Array.from(new Set(Array.from(text.toUpperCase()).filter((c) => /[A-Z0-9]/.test(c))));
  return (chars.length ? chars : Array.from(FALLBACK)).slice(0, ATLAS_COLS * ATLAS_COLS);
}

export function create(ctx: FxContext, initial: WarpFieldOptions): FxInstance<WarpFieldOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const gl = getGL(canvas, { antialias: true });
  if (!gl) throw new Error("WebGL unavailable");

  const lines = createProgram(gl, LINE_VS, LINE_FS);
  const tilesProgram = createProgram(gl, TILE_VS, TILE_FS);
  const lineBuffer = gl.createBuffer();
  const tileBuffer = gl.createBuffer();
  const atlasTexture = gl.createTexture();
  const family = resolveFontFamily("--font-mono");

  let palette = ctx.palette;
  let bg: RGB = [0, 0, 0];
  let streakColours: RGB[] = [];
  let tileColours: RGB[] = [];
  let glyphs: string[] = [];
  let still = false;
  let clock = 0;
  const proj: Mat4 = new Float32Array(16);
  let aspect = 1;

  // Streak geometry: two endpoints a segment, position + colour interleaved
  const streak = new Float32Array(STREAKS * 2 * 6);
  const lengths = new Float32Array(STREAKS);
  const tiles: Tile[] = [];
  const tileData = new Float32Array(TILES * 6 * 8);
  const model: Mat4 = new Float32Array(16);

  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

  const recolour = () => {
    if (opts.sourcePalette) {
      bg = SOURCE.bg;
      streakColours = SOURCE.streaks;
      tileColours = SOURCE.tiles;
    } else {
      const accent = opts.accent ? resolveToken(opts.accent) : palette.glow;
      bg = palette.base;
      streakColours = [accent, palette.glow, palette.deep, palette.text];
      tileColours = [palette.text, mixRGB(accent, palette.text, 0.5), accent];
    }
    for (let i = 0; i < STREAKS; i++) {
      const c = pick(streakColours);
      streak.set(c, i * 12 + 3);
      streak.set(c, i * 12 + 9);
    }
    for (const t of tiles) t.col = pick(tileColours);
  };

  const buildAtlas = () => {
    glyphs = glyphsFrom(opts.text);
    const atlas = document.createElement("canvas");
    atlas.width = atlas.height = ATLAS_CELL * ATLAS_COLS;
    const a = atlas.getContext("2d");
    if (a) {
      a.fillStyle = "#fff";
      a.font = `700 ${Math.round(ATLAS_CELL * 0.68)}px ${family}`;
      a.textAlign = "center";
      a.textBaseline = "middle";
      glyphs.forEach((ch, i) => {
        a.fillText(ch, (i % ATLAS_COLS) * ATLAS_CELL + ATLAS_CELL / 2, Math.floor(i / ATLAS_COLS) * ATLAS_CELL + ATLAS_CELL * 0.54);
      });
    }
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    for (const t of tiles) t.glyph = Math.floor(Math.random() * glyphs.length);
  };

  const seedStreak = (i: number, z: number) => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 800 + 20;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const len = Math.random() * 150 + 50;
    lengths[i] = len;
    streak[i * 12] = x;
    streak[i * 12 + 1] = y;
    streak[i * 12 + 2] = z;
    streak[i * 12 + 6] = x;
    streak[i * 12 + 7] = y;
    streak[i * 12 + 8] = z + len;
  };

  const seedTile = (t: Partial<Tile>, z: number): Tile => {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 430 + 60;
    return Object.assign(t, {
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      z,
      scale: Math.random() * 30 + 24,
      rx: 0,
      ry: 0,
      rz: t.rz ?? 0,
      spin: t.spin ?? (Math.random() - 0.5) * 0.02,
      swayX: t.swayX ?? Math.random() * 0.5 + 0.2,
      swayY: t.swayY ?? Math.random() * 0.6 + 0.2,
      phase: t.phase ?? Math.random() * Math.PI * 2,
      drift: t.drift ?? Math.random() * 0.9 + 0.2,
      glyph: t.glyph ?? 0,
      col: t.col ?? [1, 1, 1],
    }) as Tile;
  };

  for (let i = 0; i < STREAKS; i++) seedStreak(i, (Math.random() - 0.5) * 2000);
  for (let i = 0; i < TILES; i++) tiles.push(seedTile({}, TILE_FAR + Math.random() * (TILE_NEAR - TILE_FAR)));
  buildAtlas();
  recolour();

  const corners = [
    [-0.5, -0.5, 0, 1],
    [0.5, -0.5, 1, 1],
    [0.5, 0.5, 1, 0],
    [-0.5, -0.5, 0, 1],
    [0.5, 0.5, 1, 0],
    [-0.5, 0.5, 0, 0],
  ];

  const step = (frames: number) => {
    const d = opts.speed * frames;
    for (let i = 0; i < STREAKS; i++) {
      streak[i * 12 + 2] += d;
      streak[i * 12 + 8] += d;
      if (streak[i * 12 + 2] > NEAR_Z) seedStreak(i, FAR_Z);
    }
    if (!opts.letters) return;
    const dt = d * 0.5;
    for (const t of tiles) {
      t.z += dt;
      const r = clock * t.drift + t.phase;
      t.x += Math.cos(r) * t.drift * 0.9 * frames;
      t.y += Math.sin(r * 0.8) * t.drift * 0.9 * frames;
      t.rz += t.spin * frames;
      t.rx = Math.sin(r * 0.6) * t.swayX;
      t.ry = Math.cos(r * 0.5) * t.swayY;
      if (t.z > TILE_NEAR) seedTile(t, TILE_FAR);
    }
  };

  const fillTiles = () => {
    let o = 0;
    const cols = ATLAS_COLS;
    for (const t of tiles) {
      compose([t.x, t.y, t.z], [t.rx, t.ry, t.rz], t.scale, model);
      const gx = (t.glyph % cols) / cols;
      const gy = Math.floor(t.glyph / cols) / cols;
      for (const [cx, cy, u, v] of corners) {
        tileData[o++] = model[0] * cx + model[4] * cy + model[12];
        tileData[o++] = model[1] * cx + model[5] * cy + model[13];
        tileData[o++] = model[2] * cx + model[6] * cy + model[14];
        tileData[o++] = gx + u / cols;
        tileData[o++] = gy + v / cols;
        tileData[o++] = t.col[0];
        tileData[o++] = t.col[1];
        tileData[o++] = t.col[2];
      }
    }
  };

  // Each pass enables only its own arrays and turns them off after, so the two programs never
  // inherit each other's attribute pointers
  const enabled: number[] = [];
  const attrib = (program: WebGLProgram, name: string, size: number, stride: number, offset: number) => {
    const loc = gl.getAttribLocation(program, name);
    if (loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offset * 4);
    enabled.push(loc);
  };
  const release = () => {
    while (enabled.length) gl.disableVertexAttribArray(enabled.pop()!);
  };

  const draw = () => {
    perspective(opts.fov, aspect, 0.1, 2000, proj);
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);

    // Streaks, added
    gl.useProgram(lines.program);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniformMatrix4fv(lines.uniform("u_proj"), false, proj);
    gl.uniform1f(lines.uniform("u_fog"), FOG);
    gl.uniform1f(lines.uniform("u_opacity"), opts.streakOpacity);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, streak, gl.DYNAMIC_DRAW);
    attrib(lines.program, "a_pos", 3, 6, 0);
    attrib(lines.program, "a_col", 3, 6, 3);
    gl.drawArrays(gl.LINES, 0, STREAKS * 2);
    release();

    // Letter tiles, premultiplied over
    if (opts.letters) {
      fillTiles();
      gl.useProgram(tilesProgram.program);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(tilesProgram.uniform("u_proj"), false, proj);
      gl.uniform1f(tilesProgram.uniform("u_fog"), FOG);
      gl.uniform1f(tilesProgram.uniform("u_opacity"), opts.tileOpacity);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.uniform1i(tilesProgram.uniform("u_atlas"), 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, tileBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, tileData, gl.DYNAMIC_DRAW);
      attrib(tilesProgram.program, "a_pos", 3, 8, 0);
      attrib(tilesProgram.program, "a_uv", 2, 8, 3);
      attrib(tilesProgram.program, "a_col", 3, 8, 5);
      gl.drawArrays(gl.TRIANGLES, 0, TILES * 6);
      release();
    }
    gl.disable(gl.BLEND);
  };

  return {
    resize(w, h, pr) {
      aspect = Math.max(1, w) / Math.max(1, h);
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (still) draw();
    },

    render(_now, dt) {
      const frames = Math.min(50, dt) / 16.67;
      clock += frames / 60;
      step(frames);
      draw();
    },

    update(next) {
      const reglyph = next.text !== undefined && next.text !== opts.text;
      opts = { ...opts, ...next };
      if (reglyph) buildAtlas();
      recolour();
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw();
    },

    still() {
      still = true;
      draw();
    },

    dispose() {
      gl.deleteBuffer(lineBuffer);
      gl.deleteBuffer(tileBuffer);
      gl.deleteTexture(atlasTexture);
      lines.dispose();
      tilesProgram.dispose();
    },
  };
}

import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { createProgram, getGL } from "@/components/fx/runtime/gl";
import { mixRGB, rgbToCss } from "@/components/fx/runtime/palette";
import { resolveFontFamily } from "@/components/fx/runtime/fonts";
import type { CrtBootOptions } from "./meta";

/**
 * Port of ThreeUI's CRT background in its "terminal" style (MIT, Meng To): a boot log typed
 * into a 2D canvas, uploaded as a texture and drawn through a CRT shader (barrel curve,
 * per-channel fringe, halation, scanlines, aperture grille, rolling bar, flicker, vignette).
 * The shader and style constants are the original's; the log is the workshop's own, and the
 * phosphor colours come from the room palette.
 */

const VERTEX = `attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos,0.0,1.0); }`;

const FRAGMENT = `precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;
uniform float uTime;
uniform float uMotion;
uniform vec2 uCurve;
uniform float uScan;
uniform float uScanDepth;
uniform float uTriad;
uniform float uGrille;
uniform float uChroma;
uniform float uBar;
uniform float uFlicker;
uniform float uGrain;
uniform float uVignette;
uniform float uGain;
uniform float uHalo;
uniform vec3 uSheen;
uniform vec3 uRoom;

float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }

vec2 curve(vec2 uv){
  uv = uv*2.0-1.0;
  vec2 o = uv.yx*uv.yx;
  uv += uv * o * uCurve;
  return uv*0.5+0.5;
}

void main(){
  vec2 fuv = gl_FragCoord.xy / uRes;
  vec2 uv = curve(fuv);
  float t = uTime;

  vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  float inside = inb.x*inb.y;
  vec2 ed = min(uv, 1.0-uv);
  inside *= smoothstep(0.0,0.020, min(ed.x,ed.y));

  vec2 dir = uv-0.5;
  float d2 = dot(dir,dir);
  vec2 ao = dir * (0.0010 + 0.0075*d2) * uChroma;
  vec3 col;
  col.r = texture2D(uTex, uv + ao).r;
  col.g = texture2D(uTex, uv).g;
  col.b = texture2D(uTex, uv - ao).b;

  float s = 0.0038;
  vec3 wide = texture2D(uTex, uv + vec2( s, 0.0)).rgb
            + texture2D(uTex, uv + vec2(-s, 0.0)).rgb
            + texture2D(uTex, uv + vec2(0.0,  s)).rgb
            + texture2D(uTex, uv + vec2(0.0, -s)).rgb
            + texture2D(uTex, uv + vec2( s,  s)*0.72).rgb
            + texture2D(uTex, uv + vec2(-s, -s)*0.72).rgb;
  col += wide * (uHalo / 6.0);

  float sl = sin(uv.y*3.14159265*uScan + t*4.0*uMotion);
  col *= mix(1.0 - uScanDepth, 1.0, sl*sl);

  float gx = gl_FragCoord.x * (6.2831853/max(uTriad, 1.0));
  vec3 grille = (1.0-uGrille) + uGrille*cos(gx + vec3(0.0,2.094,4.188));
  col *= grille;
  col *= uGain;

  float bar = fract(uv.y*0.5 - t*0.07*uMotion);
  bar = smoothstep(0.0,0.05,bar)*smoothstep(0.18,0.05,bar);
  col += bar*uBar*uMotion;

  float sheen = smoothstep(0.55,0.0, distance(uv, vec2(0.50,0.15)));
  col += sheen*0.030*uSheen;

  float vig = smoothstep(0.98,0.30, length((uv-0.5)*vec2(1.05,1.0)));
  col *= mix(1.0-uVignette, 1.0, vig);
  col *= 1.0 - uFlicker*uMotion*sin(t*8.0);
  col += (hash(fuv + fract(t*0.37)) - 0.5)*uGrain;

  float spill = smoothstep(0.85,0.18, length(fuv-0.5))*0.05;
  vec3 room = uRoom + uSheen*spill*0.42;
  col = mix(room, col, inside);
  col = max(col, uRoom*0.34);
  gl_FragColor = vec4(col,1.0);
}`;

/** The original's terminal style */
const STYLE = {
  curve: [0.115, 0.165] as [number, number],
  scanDensity: 0.44,
  scanDepth: 0.3,
  triadCss: 3.2,
  grille: 0.34,
  chroma: 1,
  bar: 0.045,
  flicker: 0.028,
  grain: 0.022,
  vignette: 0.58,
  gain: 1.34,
  halo: 0.1,
};

type Tone = "p" | "d" | "a" | "h";
type Run = { t: string; c: Tone };
const run = (t: string, c: Tone = "p"): Run => ({ t, c });
const dots = (n: number) => "·".repeat(n);

function bootLog(projects: number): Run[][] {
  const found = projects > 0 ? `${projects} found` : "OK";
  return [
    [run("HZY/OS  v2.0.26"), run("   (c) 2026 hayzaydee", "d")],
    [run("WORKSHOP BIOS  rev N0RTH  S/N DE-2024-SE", "d")],
    [],
    [run("probing workspace "), run(`${dots(11)} `, "d"), run("OK", "a")],
    [run("mounting /projects "), run(`${dots(10)} `, "d"), run(found, "a")],
    [run("loading stack.json "), run(`${dots(10)} `, "d"), run("OK", "a")],
    [run("node runtime  v22 ", "d"), run(`${dots(11)} `, "d"), run("READY", "a")],
    [run("linking /dev/coffee "), run(`${dots(9)} `, "d"), run("OK", "a")],
    [run("compiling patience "), run(`${dots(10)} `, "d"), run("87%")],
    [run("starting ask() terminal "), run(`${dots(5)} `, "d"), run("READY", "a")],
    [],
    [run("still growing. "), run("welcome back.", "h")],
    [],
    [run("hayzaydee@workshop:~$ ")],
  ];
}

const lineLength = (line: Run[]) => line.reduce((n, r) => n + r.t.length, 0);

/** Text canvas resolution limits, from the original */
const MAX_W = 1920;
const MIN_W = 640;
const MAX_PIXELS = 2.4e6;
const CHARS_PER_FRAME = 4.4;

type Tones = Record<Tone, { fill: string; glow: string }>;

export function create(ctx: FxContext, initial: CrtBootOptions): FxInstance<CrtBootOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error("WebGL unavailable");

  const program = createProgram(gl, VERTEX, FRAGMENT);
  gl.useProgram(program.program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program.program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(program.uniform("uTex"), 0);

  const text = document.createElement("canvas");
  const tg = text.getContext("2d");
  if (!tg) throw new Error("CRT text canvas unavailable");
  const family = resolveFontFamily("--font-mono");

  let palette = ctx.palette;
  let log = bootLog(opts.projects);
  let total = log.reduce((n, l) => n + lineLength(l), 0);
  let widest = Math.max(...log.map(lineLength));
  let tones: Tones;
  let ground = "";
  let room: RGB = [0, 0, 0];
  let sheen: RGB = [0, 0, 0];

  let cssW = 1;
  let cssH = 1;
  let tw = 1;
  let th = 1;
  let fontPx = 14;
  let lineH = 20;
  let top = 0;
  let advance = 8;
  let cursorX = 0;
  let cursorY = 0;

  let typed = 0;
  let finished = false;
  let elapsed = 0;
  let lastDrawn = -1;
  let lastBlink = -1;
  let sinceDraw = 0;
  let dirty = true;
  let still = false;
  let onDone: (() => void) | null = null;

  const recolour = () => {
    const src = opts.sourcePalette;
    const p = src ? null : palette;
    const fill = (rgb: RGB) => rgbToCss(rgb);
    const glow = (rgb: RGB, a: number) => rgbToCss(rgb, a);
    const P: RGB = p ? mixRGB(p.glow, p.text, 0.45) : [0.55, 0.94, 0.71];
    const D: RGB = p ? mixRGB(p.deep, p.glow, 0.35) : [0.31, 0.6, 0.46];
    const A: RGB = p ? p.warm : [1, 0.73, 0.37];
    const H: RGB = p ? p.text : [0.92, 1, 0.95];
    const G: RGB = p ? p.glow : [0.11, 0.93, 0.52];
    tones = {
      p: { fill: fill(P), glow: glow(G, 0.95) },
      d: { fill: fill(D), glow: glow(G, 0.45) },
      a: { fill: fill(A), glow: glow(A, 0.95) },
      h: { fill: fill(H), glow: glow(G, 0.95) },
    };
    const base: RGB = p ? p.base : [0.012, 0.063, 0.039];
    ground = fill(mixRGB(base, [0, 0, 0], 0.4));
    room = p ? mixRGB(base, [0, 0, 0], 0.6) : [0.012, 0.03, 0.022];
    sheen = p ? mixRGB(p.glow, p.text, 0.5) : [0.55, 1, 0.78];
    dirty = true;
  };

  const layout = () => {
    top = th * 0.135;
    lineH = (th * 0.74) / log.length;
    fontPx = Math.max(5, Math.min(lineH * 0.8, (tw * 0.88) / (Math.max(widest, 1) * 0.62)));
    tg.font = `600 ${fontPx.toFixed(2)}px ${family}`;
    advance = tg.measureText("M").width || fontPx * 0.6;
  };

  const setTone = (tone: Tone, glowing: boolean) => {
    const t = tones[tone];
    tg.fillStyle = t.fill;
    tg.shadowColor = glowing ? t.glow : "transparent";
    tg.shadowBlur = glowing ? fontPx * 0.38 : 0;
  };

  const paint = (count: number) => {
    tg.setTransform(1, 0, 0, 1, 0, 0);
    tg.shadowBlur = 0;
    tg.fillStyle = ground;
    tg.fillRect(0, 0, tw, th);
    tg.textAlign = "left";
    tg.textBaseline = "top";
    tg.font = `600 ${fontPx.toFixed(2)}px ${family}`;
    const left = Math.floor((tw - widest * advance) / 2);
    let remaining = count;
    let y = top;
    cursorX = left;
    cursorY = y;
    for (const line of log) {
      const take = Math.min(remaining, lineLength(line));
      let x = left;
      let used = 0;
      for (const r of line) {
        if (used >= take) break;
        const chunk = r.t.slice(0, take - used);
        // Twice: once glowing for the halation, once crisp on top
        setTone(r.c, true);
        tg.fillText(chunk, x, y);
        setTone(r.c, false);
        tg.fillText(chunk, x, y);
        x += advance * chunk.length;
        used += chunk.length;
      }
      cursorX = x;
      cursorY = y;
      remaining -= take;
      if (remaining <= 0) break;
      y += lineH;
    }
  };

  const paintCursor = () => {
    tg.shadowColor = tones.p.glow;
    tg.shadowBlur = fontPx * 0.42;
    tg.fillStyle = tones.h.fill;
    tg.fillRect(cursorX, cursorY + fontPx * 0.06, Math.max(advance * 0.92, 4), fontPx * 0.96);
    tg.shadowBlur = 0;
  };

  const upload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, text);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    dirty = false;
  };

  const uniforms = () => {
    gl.uniform2f(program.uniform("uCurve"), STYLE.curve[0], STYLE.curve[1]);
    gl.uniform1f(program.uniform("uScanDepth"), STYLE.scanDepth);
    gl.uniform1f(program.uniform("uGrille"), STYLE.grille);
    gl.uniform1f(program.uniform("uChroma"), STYLE.chroma);
    gl.uniform1f(program.uniform("uBar"), STYLE.bar);
    gl.uniform1f(program.uniform("uFlicker"), STYLE.flicker);
    gl.uniform1f(program.uniform("uGrain"), STYLE.grain);
    gl.uniform1f(program.uniform("uVignette"), STYLE.vignette);
    gl.uniform1f(program.uniform("uGain"), STYLE.gain);
    gl.uniform1f(program.uniform("uHalo"), STYLE.halo);
    gl.uniform3fv(program.uniform("uSheen"), sheen);
    gl.uniform3fv(program.uniform("uRoom"), room);
  };

  /** Repaint the text when the typed count or the cursor blink changes (at most every 42ms while typing) */
  const refresh = (dt: number) => {
    sinceDraw += dt;
    const count = finished ? Infinity : Math.floor(typed);
    const blink = Math.floor(elapsed / 0.42) % 2 === 0 ? 1 : 0;
    const due = finished ? blink !== lastBlink : sinceDraw > 42;
    if (!dirty && !due) return;
    if (!dirty && count === lastDrawn && blink === lastBlink) return;
    paint(count);
    if (blink) paintCursor();
    lastDrawn = count;
    lastBlink = blink;
    sinceDraw = 0;
    dirty = true;
  };

  const draw = () => {
    if (dirty) upload();
    gl.useProgram(program.program);
    gl.uniform1f(program.uniform("uTime"), elapsed);
    gl.uniform1f(program.uniform("uMotion"), still ? 0 : opts.motion);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    typed = total;
    canvas.dataset.typed = "done";
    onDone?.();
  };

  recolour();
  uniforms();

  return {
    resize(w, h, pr) {
      cssW = Math.max(1, w);
      cssH = Math.max(1, h);
      let bw = Math.max(MIN_W, Math.round(Math.min(cssW * pr, MAX_W)));
      let bh = Math.max(1, Math.round((bw * cssH) / cssW));
      if (bw * bh > MAX_PIXELS) {
        const k = Math.sqrt(MAX_PIXELS / (bw * bh));
        bw = Math.round(bw * k);
        bh = Math.round(bh * k);
      }
      canvas.width = bw;
      canvas.height = bh;
      if (text.width !== bw || text.height !== bh) {
        text.width = tw = bw;
        text.height = th = bh;
        layout();
        lastDrawn = -1;
        dirty = true;
      }
      gl.viewport(0, 0, bw, bh);
      gl.uniform2f(program.uniform("uRes"), bw, bh);
      gl.uniform1f(program.uniform("uScan"), Math.max(120, Math.min(cssH * STYLE.scanDensity, 900)));
      gl.uniform1f(program.uniform("uTriad"), Math.max(2, (STYLE.triadCss * bw) / cssW));
      if (still) {
        refresh(0);
        draw();
      }
    },

    render(_now, dt) {
      const step = Math.min(64, dt);
      elapsed += step / 1000;
      if (!finished) {
        typed += CHARS_PER_FRAME * opts.typeSpeed * (step / 16.67);
        if (typed >= total) finish();
      }
      refresh(step);
      draw();
    },

    update(next) {
      const relog = next.projects !== undefined && next.projects !== opts.projects;
      opts = { ...opts, ...next };
      if (relog) {
        log = bootLog(opts.projects);
        total = log.reduce((n, l) => n + lineLength(l), 0);
        widest = Math.max(...log.map(lineLength));
        layout();
      }
      recolour();
      uniforms();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      uniforms();
    },

    still() {
      // Reduced motion: the whole log at once, nothing rolling
      still = true;
      finish();
      refresh(0);
      draw();
    },

    command(name, arg) {
      if (name === "done") {
        onDone = typeof arg === "function" ? (arg as () => void) : null;
        if (finished) onDone?.();
      } else if (name === "finish") {
        finish();
      }
    },

    dispose() {
      onDone = null;
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      program.dispose();
    },
  };
}

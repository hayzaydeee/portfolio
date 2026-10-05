import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { bindFullscreenTriangle, createProgram, FULLSCREEN_VERTEX, getGL } from "@/components/fx/runtime/gl";
import { rgbToCss } from "@/components/fx/runtime/palette";
import { BELL_FIELD_FRAGMENT } from "./shaders";
import type { BellFieldOptions } from "./meta";

type Ember = { x: number; y: number; r: number; vy: number; vx: number; ph: number; sp: number; hot: boolean };
type Strike = { x: number; y: number; start: number; strength: number };
type Colors = { deep: RGB; patina: RGB; bronze: RGB; ash: RGB; emberHot: RGB; emberCool: RGB };

const SOURCE_COLORS: Colors = {
  deep: [0.031, 0.055, 0.051],
  patina: [0.306, 0.608, 0.541],
  bronze: [0.847, 0.608, 0.247],
  ash: [0.937, 0.914, 0.863],
  emberHot: [231 / 255, 193 / 255, 101 / 255],
  emberCool: [143 / 255, 203 / 255, 185 / 255],
};

function roomColors(p: RoomPalette): Colors {
  return { deep: p.base, patina: p.glow, bronze: p.warm, ash: p.text, emberHot: p.warm, emberCool: p.glow };
}

const EMBER_COUNT = 58;
const FIRST_IDLE_STRIKE_S = 1.7;
const IDLE_STRIKE_EVERY_S = 8.2;
const STILL_TIME_S = 14;

export function create(ctx: FxContext, initial: BellFieldOptions): FxInstance<BellFieldOptions> {
  let opts = { ...initial };
  const { canvas, layer } = ctx;
  const gl = getGL(canvas);
  if (!gl) throw new Error("WebGL unavailable");

  const program = createProgram(gl, FULLSCREEN_VERTEX, BELL_FIELD_FRAGMENT);
  gl.useProgram(program.program);
  const disposeTriangle = bindFullscreenTriangle(gl, program.program);

  const embersCanvas = document.createElement("canvas");
  embersCanvas.className = "absolute inset-0 size-full pointer-events-none";
  layer.appendChild(embersCanvas);
  const ec = embersCanvas.getContext("2d")!;

  let palette = ctx.palette;
  let colors = opts.sourcePalette ? SOURCE_COLORS : roomColors(palette);
  const applyColors = () => {
    gl.uniform3fv(program.uniform("u_deep"), colors.deep);
    gl.uniform3fv(program.uniform("u_patina"), colors.patina);
    gl.uniform3fv(program.uniform("u_bronze"), colors.bronze);
    gl.uniform3fv(program.uniform("u_ash"), colors.ash);
  };
  applyColors();

  let width = 1;
  let height = 1;
  let pr = 1;
  let elapsed = 0; // seconds of scaled time; pauses with the ticker
  let mouseX = 0.5;
  let mouseY = 0.5;
  let pointerReady = false;
  let nextIdleStrike = FIRST_IDLE_STRIKE_S;
  let lastAudioStrike = -Infinity;
  let highEma = 0;
  let rmsEma = 0;
  let still = false;

  const strikes: Strike[] = Array.from({ length: 4 }, () => ({ x: 0, y: 0.08, start: -1e9, strength: 0 }));
  const strikeData = new Float32Array(16);

  const embers: Ember[] = Array.from({ length: EMBER_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.4 + Math.random() * 1.4,
    vy: -(0.1 + Math.random() * 0.26),
    vx: (Math.random() - 0.5) * 0.08,
    ph: Math.random() * Math.PI * 2,
    sp: 0.5 + Math.random() * 1.4,
    hot: Math.random() < 0.36,
  }));
  let embersPlaced = false;

  /** CSS px within the stage → shader field space (centre of the bell is the origin) */
  const toField = (x: number, y: number): [number, number] => [
    ((x / width) * 2 - 1) * (width / height),
    (1 - y / height) * 2 - 1 + 0.08,
  ];

  const strike = (x: number, y: number, strength: number) => {
    const slot = strikes.reduce((oldest, s) => (s.start < oldest.start ? s : oldest), strikes[0]);
    slot.x = x;
    slot.y = y;
    slot.start = elapsed * 1000;
    slot.strength = strength;
  };

  const drawEmbers = (dtScale: number, t: number) => {
    ec.clearRect(0, 0, width, height);
    const audioBoost = 1 + highEma * 3 * opts.audioGain;
    const count = Math.max(0, Math.min(EMBER_COUNT, Math.round(EMBER_COUNT * opts.emberAmount * audioBoost)));
    for (let i = 0; i < count; i++) {
      const e = embers[i];
      e.y += e.vy * dtScale;
      e.x += (e.vx + Math.sin(t * e.sp * 0.5 + e.ph) * 0.13) * dtScale;
      if (e.y < -4) {
        e.y = height + 4;
        e.x = Math.random() * width;
      }
      if (e.x < -4) e.x = width + 4;
      if (e.x > width + 4) e.x = -4;
      const twinkle = 0.5 + 0.5 * Math.sin(t * e.sp + e.ph);
      ec.beginPath();
      ec.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ec.fillStyle = e.hot
        ? rgbToCss(colors.emberHot, 0.06 + twinkle * 0.34)
        : rgbToCss(colors.emberCool, 0.04 + twinkle * 0.24);
      ec.fill();
    }
  };

  const draw = () => {
    gl.uniform1f(program.uniform("u_time"), elapsed);
    gl.uniform2f(program.uniform("u_mouse"), mouseX * pr, mouseY * pr);
    gl.uniform1f(program.uniform("u_brightness"), opts.brightness);
    gl.uniform1f(program.uniform("u_energy"), 1 + rmsEma * 0.8 * opts.audioGain);
    const nowMs = elapsed * 1000;
    strikes.forEach((s, i) => {
      const age = Math.min(1, Math.max(0, (nowMs - s.start) / opts.strikeDuration));
      strikeData.set([s.x, s.y, age, s.strength], i * 4);
    });
    gl.uniform4fv(program.uniform("u_strikes[0]"), strikeData);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const instance: FxInstance<BellFieldOptions> = {
    resize(w, h, pixelRatio) {
      width = Math.max(1, w);
      height = Math.max(1, h);
      pr = pixelRatio;
      canvas.width = Math.max(1, Math.round(width * pr));
      canvas.height = Math.max(1, Math.round(height * pr));
      embersCanvas.width = canvas.width;
      embersCanvas.height = canvas.height;
      ec.setTransform(pr, 0, 0, pr, 0, 0);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(program.uniform("u_resolution"), canvas.width, canvas.height);
      if (!pointerReady) {
        mouseX = width / 2;
        mouseY = height / 2;
        pointerReady = true;
      }
      if (!embersPlaced) {
        embers.forEach((e) => {
          e.x *= width;
          e.y *= height;
        });
        embersPlaced = true;
      }
      if (still) {
        draw();
        drawEmbers(0, elapsed);
      }
    },

    render(now, dt) {
      const step = (dt / 1000) * opts.speed;
      elapsed += step;
      const dtScale = (dt / 16.67) * opts.speed;

      const pointer = ctx.pointer();
      const tx = pointer.seen && pointer.inside ? width / 2 + (pointer.x - width / 2) * opts.pointerAmount : width / 2;
      const ty = pointer.seen && pointer.inside ? height / 2 + (pointer.y - height / 2) * opts.pointerAmount : height / 2;
      const ease = 1 - Math.pow(1 - 0.04, dt / 16.67);
      mouseX += (tx - mouseX) * ease;
      mouseY += (ty - mouseY) * ease;

      const frame = opts.audioReactive && ctx.audio ? ctx.audio(now) : null;
      const playing = !!frame?.playing;
      const k = 1 - Math.pow(0.9, dt / 16.67);
      highEma += ((playing ? frame!.bands[4] : 0) - highEma) * k;
      rmsEma += ((playing ? frame!.rms : 0) - rmsEma) * k;

      if (playing && frame!.onset > 0 && elapsed * 1000 - lastAudioStrike > opts.strikeDuration * 0.4) {
        strike(0, 0.08, Math.min(1.4, 0.6 + frame!.onset * 8));
        lastAudioStrike = elapsed * 1000;
      } else if (!playing && opts.idleStrikes && elapsed >= nextIdleStrike) {
        strike(0, 0.08, 1);
        nextIdleStrike = elapsed + IDLE_STRIKE_EVERY_S;
      }

      draw();
      drawEmbers(dtScale, elapsed);
    },

    update(next) {
      const paletteModeChanged = next.sourcePalette !== undefined && next.sourcePalette !== opts.sourcePalette;
      opts = { ...opts, ...next };
      canvas.style.opacity = String(opts.opacity);
      embersCanvas.style.opacity = String(opts.opacity);
      if (paletteModeChanged) {
        colors = opts.sourcePalette ? SOURCE_COLORS : roomColors(palette);
        applyColors();
      }
      if (still) draw();
    },

    setPalette(next) {
      palette = next;
      if (!opts.sourcePalette) {
        colors = roomColors(palette);
        applyColors();
      }
    },

    still() {
      still = true;
      elapsed = STILL_TIME_S;
      draw();
      drawEmbers(0, elapsed);
    },

    command(name, arg) {
      if (name === "click" && arg && typeof arg === "object") {
        const { x, y } = arg as { x: number; y: number };
        const [fx, fy] = toField(x, y);
        strike(fx, fy, 1);
      } else if (name === "strike") {
        strike(0, 0.08, typeof arg === "number" ? arg : 1);
      }
    },

    dispose() {
      disposeTriangle();
      program.dispose();
      embersCanvas.remove();
    },
  };

  instance.update({});
  return instance;
}

import type { FxContext, FxInstance, RGB, RoomKey, RoomPalette } from "@/components/fx/runtime/types";
import { bindFullscreenTriangle, createProgram, FULLSCREEN_VERTEX, getGL } from "@/components/fx/runtime/gl";
import { getRoomPalette, mixRGB } from "@/components/fx/runtime/palette";
import {
  easeInOutCubic,
  isPortalPhase,
  phaseProgress,
  type PortalPhaseCommand,
} from "@/components/fx/effects/portal-timeline";
import { PORTAL_FIELD_FRAGMENT } from "./shaders";
import type { PortalFieldOptions } from "./meta";

type Colors = { void: RGB; core: RGB; fringe: RGB };

const SOURCE: Colors = { void: [0.008, 0.008, 0.008], core: [1, 1, 1], fringe: [0.118, 0.227, 0.541] };

/** Radius of the closed portal while the next route loads */
const CLOSED_RADIUS = 0.035;
/** Lab preview: a ring floating over the stage when no trip is running */
const RESTING_RADIUS = 0.32;

function roomColors(p: RoomPalette): Colors {
  return { void: p.base, core: mixRGB(p.text, p.glow, 0.35), fringe: p.glow };
}

export function create(ctx: FxContext, initial: PortalFieldOptions): FxInstance<PortalFieldOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const gl = getGL(canvas, { alpha: true, premultipliedAlpha: true });
  if (!gl) throw new Error("WebGL unavailable");

  const program = createProgram(gl, FULLSCREEN_VERTEX, PORTAL_FIELD_FRAGMENT);
  gl.useProgram(program.program);
  const disposeTriangle = bindFullscreenTriangle(gl, program.program);
  gl.clearColor(0, 0, 0, 0);

  const palettes = new Map<RoomKey, Colors>();
  const colorsFor = (room: RoomKey | null): Colors => {
    if (opts.sourcePalette) return SOURCE;
    const key = room ?? ctx.palette.room;
    if (!palettes.has(key)) palettes.set(key, roomColors(key === ctx.palette.room ? ctx.palette : getRoomPalette(key)));
    return palettes.get(key)!;
  };

  let cmd: PortalPhaseCommand | null = null;
  let demo: { at: number; to: RoomKey } | null = null;
  let elapsed = 0;
  let reach = 1;
  const size = { w: 1, h: 1 };
  let still = false;
  const mouse = { x: 0, y: 0 };

  /** The lab's demo plays a whole trip on the effect's own clock */
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

  const draw = (now: number) => {
    const active = demoPhase(now) ?? cmd;
    const p = phaseProgress(active, now);
    const e = easeInOutCubic(p);
    const to = colorsFor(active?.to ?? null);
    const from = colorsFor(active?.from ?? null);

    let radius = RESTING_RADIUS;
    let ring = 1;
    let voidAlpha = 0;
    let fringe = to.fringe;

    if (active?.name === "cover") {
      radius = reach + (CLOSED_RADIUS - reach) * e;
      voidAlpha = 1;
      fringe = mixRGB(from.fringe, to.fringe, e);
    } else if (active?.name === "hold") {
      radius = CLOSED_RADIUS + 0.012 * Math.sin(elapsed * 3);
      voidAlpha = 1;
    } else if (active?.name === "reveal") {
      radius = CLOSED_RADIUS + (reach - CLOSED_RADIUS) * e;
      voidAlpha = p < 1 ? 1 : 0;
      ring = 1 - e * e * e;
    } else if (cmd) {
      // A trip ended (reveal complete): draw nothing until the host unmounts us
      ring = 0;
    }

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(program.uniform("u_time"), elapsed);
    gl.uniform2f(program.uniform("u_mouse"), mouse.x * opts.pointerAmount, mouse.y * opts.pointerAmount);
    gl.uniform1f(program.uniform("u_radius"), radius);
    gl.uniform1f(program.uniform("u_ring"), ring * opts.intensity);
    gl.uniform1f(program.uniform("u_warp"), opts.warp);
    gl.uniform1f(program.uniform("u_fringe"), opts.fringe);
    gl.uniform1f(program.uniform("u_void_alpha"), voidAlpha);
    gl.uniform3fv(program.uniform("u_void"), to.void);
    gl.uniform3fv(program.uniform("u_core"), to.core);
    gl.uniform3fv(program.uniform("u_fringe_color"), fringe);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    resize(w, h, pr) {
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(program.uniform("u_res"), canvas.width, canvas.height);
      // Far enough that the open iris clears every corner, in min-dimension units
      size.w = Math.max(1, w);
      size.h = Math.max(1, h);
      reach = (0.5 * Math.hypot(w, h)) / Math.max(1, Math.min(w, h)) + 0.12;
      if (still) draw(performance.now());
    },

    render(now, dt) {
      elapsed += dt / 1000;
      const ptr = ctx.pointer();
      const tx = ptr.seen ? ptr.x / size.w - 0.5 : 0;
      const ty = ptr.seen ? 0.5 - ptr.y / size.h : 0;
      const k = 1 - Math.exp(-dt / 400);
      mouse.x += (tx - mouse.x) * k;
      mouse.y += (ty - mouse.y) * k;
      draw(now);
    },

    update(next) {
      if (next.sourcePalette !== undefined && next.sourcePalette !== opts.sourcePalette) palettes.clear();
      opts = { ...opts, ...next };
      if (still) draw(performance.now());
    },

    setPalette() {
      palettes.clear();
    },

    still() {
      still = true;
      elapsed = 2;
      draw(performance.now());
    },

    command(name, arg) {
      if (name === "phase" && isPortalPhase(arg)) cmd = arg;
      else if (name === "demo") demo = { at: performance.now(), to: (arg as RoomKey) ?? "studio" };
      if (still) draw(performance.now());
    },

    dispose() {
      disposeTriangle();
      program.dispose();
    },
  };
}

import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { FRAG_BLUR, FRAG_COMP, FRAG_DOWN, FRAG_RIM, FRAG_SCENE, VERT } from "./shaders";
import type { LiquidMetalOptions } from "./meta";

/**
 * Port of ThreeUI's Liquid Metal Button (MIT, Meng To) as the player's round key. The five
 * passes are the original's: the metal field and the rim, each to its own target; the
 * metal softened at half resolution; a bloom fed by both; and the composite. The real
 * <button> sits over the canvas, so the key is drawn centred in a square stage and told
 * about hover, press and focus by commands instead of listening for them itself.
 *
 * Added for the player: while music plays the metal lights with its loudness, and kicks
 * throw softer ripples than a press does.
 */

// The original's tunables: the metal field (uP), the rim (uE), the composite and the
// disturbances. Two are lowered for a key half the original's size, where the published
// gain (1.9) and veil (0.44) blow the face out to white over the glyph
const FIELD = [0.5, 0.55, 2.4, 2.2, 0.32, 0.12, 1.6, 0.05, 0.18, 0.04, 0.46, 0.3, 1.5, 0, 9, 1, 1.35, 0.32, -0.26, 0.1, 0.3];
const DIM = 0.3;
const RIM = [0.2, 0.82, 0.42, 0.03, 0.07, 0.35, 0.85, 1.6];
const COMP = { glowR: 1.3, glowIn: 0.3, occl: 0.62, punch: 1.5 };
const RIP = { speed: 1.85, width: 0.2, decay: 1.35, amp: 1.35, facet: 0.18, lobes: 6, sharp: 1.15, emit: 0.45 };
const PTR = { rad: 0.55, amp: 0.32, fast: 0.4, rim: 0.8, lag: 0.0016, vref: 4.5 };
/** The bloom buffer keeps the key about this many texels tall at any size */
const GLOW_TEX = 129;
/** Kicks closer together than this share one ripple */
const ONSET_GAP = 0.9;

type Prog = { program: WebGLProgram; shaders: WebGLShader[]; loc: (name: string) => WebGLUniformLocation | null };
type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };

function compile(gl: WebGL2RenderingContext, fragment: string): Prog {
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type);
    if (!s) throw new Error("createShader failed");
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s) ?? "liquid metal shader failed");
    return s;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, fragment);
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "position");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(program) ?? "liquid metal link failed");
  const locations = new Map<string, WebGLUniformLocation | null>();
  const count = (gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number) ?? 0;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) locations.set(info.name.replace("[0]", ""), gl.getUniformLocation(program, info.name));
  }
  // Uniforms the compiler dropped read as null, which WebGL ignores
  return { program, shaders: [vs, fs], loc: (name) => locations.get(name) ?? null };
}

const tintFrom = (c: RGB): RGB => {
  const m = Math.max(c[0], c[1], c[2], 1e-3);
  return [c[0] / m, c[1] / m, c[2] / m];
};

export function create(ctx: FxContext, initial: LiquidMetalOptions): FxInstance<LiquidMetalOptions> {
  let opts = { ...initial };
  let palette = ctx.palette;
  const { canvas } = ctx;
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" });
  if (!gl) throw new Error("WebGL2 unavailable");

  const pScene = compile(gl, FRAG_SCENE);
  const pRim = compile(gl, FRAG_RIM);
  const pDown = compile(gl, FRAG_DOWN);
  const pBlur = compile(gl, FRAG_BLUR);
  const pComp = compile(gl, FRAG_COMP);
  const programs = [pScene, pRim, pDown, pBlur, pComp];

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const halfFloat = !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
  const makeTarget = (): Target => {
    const tex = gl.createTexture() as WebGLTexture;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer() as WebGLFramebuffer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w: 0, h: 0 };
  };
  const sizeTarget = (t: Target, w: number, h: number) => {
    if (t.w === w && t.h === h) return;
    t.w = w;
    t.h = h;
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    if (halfFloat) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  };
  // Full res: metal and rim. Half res: the softening blur. 1/DOWN: the bloom
  const tCore = makeTarget();
  const tRim = makeTarget();
  const tS1 = makeTarget();
  const tS2 = makeTarget();
  const tA = makeTarget();
  const tB = makeTarget();
  const targets = [tCore, tRim, tS1, tS2, tA, tB];

  let W = 2;
  let H = 2;
  let pr = 1;
  let key = 1;
  let down = 1;

  const field = new Float32Array(FIELD);
  const rim = new Float32Array(RIM);
  const ripples = [0, 1, 2].map(() => ({ x: 0, y: 0, t: -99, amp: 0 }));
  const ripArr = new Float32Array(12);
  let ripNext = 0;
  let ripCount = 0;

  const on = { over: false, press: false, focus: false };
  let still = false;
  let clock = 0;
  let hover = 0;
  let press = 0;
  let audioLit = 0;
  let lastOnset = -99;
  let lit = false;
  canvas.dataset.lit = "0";
  let sounding = false;
  const ptr = { x: 0, y: 0 };
  const ptrS = { x: 0, y: 0 };
  let ptrAmt = 0;
  let ptrSpeed = 0;
  let tint: RGB = [1, 1, 1];

  const retint = () => {
    const t = opts.sourcePalette ? 0 : opts.tint;
    const c = tintFrom(palette.glow);
    tint = [1 + (c[0] - 1) * t, 1 + (c[1] - 1) * t, 1 + (c[2] - 1) * t];
  };
  retint();

  /** The pointer in key heights from the key's centre, +y down */
  const localPointer = () => {
    const p = ctx.pointer();
    const keyCss = key / pr;
    return { x: (p.x - W / pr / 2) / keyCss, y: (p.y - H / pr / 2) / keyCss };
  };

  const addRipple = (x: number, y: number, amp: number) => {
    const r = ripples[ripNext];
    ripNext = (ripNext + 1) % ripples.length;
    r.x = x;
    r.y = y;
    r.t = clock;
    r.amp = amp;
    canvas.dataset.ripples = String(++ripCount);
  };

  const mark = () => {
    const nowLit = hover > 0.5;
    if (nowLit !== lit) {
      lit = nowLit;
      canvas.dataset.lit = lit ? "1" : "0";
    }
  };

  const drawTo = (t: Target | null) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    gl.viewport(0, 0, t ? t.w : W, t ? t.h : H);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const shared = (p: Prog) => {
    gl.uniform2f(p.loc("uC"), W / 2, H / 2);
    gl.uniform2f(p.loc("uHalf"), key / 2, key / 2);
    gl.uniform1f(p.loc("uT"), clock);
    gl.uniform1f(p.loc("uHover"), hover);
    gl.uniform1f(p.loc("uPress"), press);
    gl.uniform4fv(p.loc("uRip"), ripArr);
    gl.uniform4f(p.loc("uRipK"), RIP.speed, RIP.width, RIP.decay, RIP.amp);
    gl.uniform4f(p.loc("uRipK2"), RIP.facet, RIP.lobes, RIP.sharp, RIP.emit);
    gl.uniform4f(p.loc("uPtr"), ptrS.x, ptrS.y, ptrAmt, ptrSpeed);
    gl.uniform4f(p.loc("uPtrK"), PTR.rad, PTR.amp, PTR.fast, PTR.rim);
  };

  const draw = () => {
    for (let i = 0; i < ripples.length; i++) {
      const r = ripples[i];
      if (r.amp > 0 && clock - r.t > 4) r.amp = 0;
      ripArr[i * 4] = r.x;
      ripArr[i * 4 + 1] = r.y;
      ripArr[i * 4 + 2] = r.t;
      ripArr[i * 4 + 3] = r.amp;
    }
    gl.bindVertexArray(vao);

    // 1. the metal, masked to the key
    gl.useProgram(pScene.program);
    shared(pScene);
    gl.uniform1fv(pScene.loc("uP"), field);
    drawTo(tCore);

    // 2. the rim, kept out of the softening blur so it stays a hairline
    gl.useProgram(pRim.program);
    shared(pRim);
    gl.uniform1f(pRim.loc("uBw"), Math.max(0.5 * pr, opts.stroke * pr * 0.5));
    gl.uniform1fv(pRim.loc("uE"), rim);
    drawTo(tRim);

    // 3. soften the metal: half-res box down, then separable gaussians in quadrature
    gl.useProgram(pDown.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tCore.tex);
    gl.uniform1i(pDown.loc("uTex"), 0);
    gl.uniform1f(pDown.loc("uAdd"), 0);
    gl.uniform2f(pDown.loc("uDstTexel"), 1 / tS1.w, 1 / tS1.h);
    drawTo(tS1);

    gl.useProgram(pBlur.program);
    gl.uniform1i(pBlur.loc("uTex"), 0);
    gl.uniform2f(pBlur.loc("uTexel"), 1 / tS1.w, 1 / tS1.h);
    const sigma = opts.soften * (key * 0.5) * 0.95;
    if (sigma > 0.1) {
      const iters = Math.min(4, Math.max(1, Math.ceil(sigma / 3)));
      gl.uniform1f(pBlur.loc("uR"), sigma / Math.sqrt(iters) / 1.95);
      for (let i = 0; i < iters; i++) {
        gl.bindTexture(gl.TEXTURE_2D, tS1.tex);
        gl.uniform2f(pBlur.loc("uDir"), 1, 0);
        drawTo(tS2);
        gl.bindTexture(gl.TEXTURE_2D, tS2.tex);
        gl.uniform2f(pBlur.loc("uDir"), 0, 1);
        drawTo(tS1);
      }
    }

    // 4. bloom, fed by the softened metal plus the crisp rim
    gl.useProgram(pDown.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tS1.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tRim.tex);
    gl.uniform1i(pDown.loc("uTex"), 0);
    gl.uniform1i(pDown.loc("uTex2"), 1);
    gl.uniform1f(pDown.loc("uAdd"), 1);
    gl.uniform2f(pDown.loc("uDstTexel"), 1 / tA.w, 1 / tA.h);
    drawTo(tA);

    gl.useProgram(pBlur.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(pBlur.loc("uTex"), 0);
    gl.uniform2f(pBlur.loc("uTexel"), 1 / tA.w, 1 / tA.h);
    const rs = (COMP.glowR * (key / down)) / GLOW_TEX;
    for (const r of [1.0, 2.3, 5.2, 9.0]) {
      gl.uniform1f(pBlur.loc("uR"), r * rs);
      gl.bindTexture(gl.TEXTURE_2D, tA.tex);
      gl.uniform2f(pBlur.loc("uDir"), 1, 0);
      drawTo(tB);
      gl.bindTexture(gl.TEXTURE_2D, tB.tex);
      gl.uniform2f(pBlur.loc("uDir"), 0, 1);
      drawTo(tA);
    }

    // 5. composite, premultiplied over the page
    gl.useProgram(pComp.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tS1.tex);
    gl.uniform1i(pComp.loc("uSoft"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tRim.tex);
    gl.uniform1i(pComp.loc("uRim"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, tA.tex);
    gl.uniform1i(pComp.loc("uGlow"), 2);
    shared(pComp);
    gl.uniform2f(pComp.loc("uRes"), W, H);
    gl.uniform1f(pComp.loc("uGlowGain"), opts.glow);
    gl.uniform1f(pComp.loc("uGlowIn"), COMP.glowIn);
    gl.uniform1f(pComp.loc("uOccl"), COMP.occl);
    gl.uniform1f(pComp.loc("uDim"), DIM);
    gl.uniform1f(pComp.loc("uPunch"), COMP.punch);
    gl.uniform1f(pComp.loc("uFade"), Math.max(1, key * opts.pad * 0.7));
    gl.uniform3fv(pComp.loc("uTint"), tint);
    drawTo(null);
  };

  const engaged = () => on.over || on.press || on.focus;

  /** Under reduced motion nothing eases: states land at once and the frame redraws */
  const settle = () => {
    if (!still) return;
    hover = Math.max(engaged() ? 1 : 0, audioLit);
    press = on.press ? 1 : 0;
    mark();
    draw();
  };

  return {
    resize(cssW, cssH, ratio) {
      pr = ratio;
      W = Math.max(2, Math.round(cssW * ratio));
      H = Math.max(2, Math.round(cssH * ratio));
      canvas.width = W;
      canvas.height = H;
      key = Math.min(W, H) / (1 + 2 * opts.pad);
      sizeTarget(tCore, W, H);
      sizeTarget(tRim, W, H);
      const hw = Math.max(2, Math.ceil(W / 2));
      const hh = Math.max(2, Math.ceil(H / 2));
      sizeTarget(tS1, hw, hh);
      sizeTarget(tS2, hw, hh);
      down = Math.max(1, Math.min(4, Math.round(key / GLOW_TEX)));
      sizeTarget(tA, Math.max(2, Math.ceil(W / down)), Math.max(2, Math.ceil(H / down)));
      sizeTarget(tB, Math.max(2, Math.ceil(W / down)), Math.max(2, Math.ceil(H / down)));
      if (still) draw();
    },

    render(now, dtMs) {
      const dt = Math.min(dtMs / 1000, 1 / 20);
      clock += dt;

      const frame = ctx.audio?.(now) ?? null;
      const playing = !!frame?.playing;
      if (playing !== sounding) {
        sounding = playing;
        if (playing) canvas.dataset.audio = "1";
        else delete canvas.dataset.audio;
      }
      const gain = opts.audioGain;
      const wantAudio = playing && frame ? Math.min(1, 0.55 * Math.min(1, gain) + frame.rms * 2.5 * gain) : 0;
      audioLit += (wantAudio - audioLit) * (1 - Math.pow(wantAudio > audioLit ? 0.02 : 0.2, dt));
      if (playing && frame && frame.onset > 0 && gain > 0 && clock - lastOnset > ONSET_GAP) {
        lastOnset = clock;
        // A kick lands somewhere on an inner ring, softer than a press
        const a = clock * 2.399;
        addRipple(Math.cos(a) * 0.16, Math.sin(a) * 0.16, Math.min(0.9, 0.45 * gain));
      }

      // quick to bloom, a touch quicker to die; the press snaps on and lets go slowly
      const target = Math.max(engaged() ? 1 : 0, audioLit);
      hover += (target - hover) * (target > hover ? 1 - Math.pow(0.0012, dt) : 1 - Math.pow(0.00012, dt));
      if (Math.abs(target - hover) < 0.0008) hover = target;
      const pressTarget = on.press ? 1 : 0;
      press += (pressTarget - press) * (pressTarget > press ? 1 - Math.pow(1e-9, dt) : 1 - Math.pow(0.004, dt));
      if (Math.abs(pressTarget - press) < 0.002) press = pressTarget;
      mark();

      // the well trails the cursor and swells with how fast it is dragged
      if (on.over || on.press) Object.assign(ptr, localPointer());
      const lag = 1 - Math.pow(PTR.lag, dt);
      const dx = (ptr.x - ptrS.x) * lag;
      const dy = (ptr.y - ptrS.y) * lag;
      ptrS.x += dx;
      ptrS.y += dy;
      const inst = Math.min(Math.hypot(dx, dy) / Math.max(dt, 1e-3) / PTR.vref, 1);
      ptrSpeed += (inst - ptrSpeed) * (1 - Math.pow(inst > ptrSpeed ? 0.001 : 0.02, dt));
      const well = on.over || on.press ? 1 : 0;
      ptrAmt += (well - ptrAmt) * (1 - Math.pow(0.004, dt));
      if (Math.abs(well - ptrAmt) < 0.002) ptrAmt = well;

      draw();
    },

    update(next) {
      const resized = next.pad !== undefined && next.pad !== opts.pad;
      opts = { ...opts, ...next };
      retint();
      if (resized) key = Math.min(W, H) / (1 + 2 * opts.pad);
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      retint();
      if (still) draw();
    },

    command(name, arg) {
      if (name === "hover") {
        on.over = arg === true;
        if (on.over) {
          // land the well where the cursor entered, not where it last was
          Object.assign(ptr, localPointer());
          Object.assign(ptrS, ptr);
          ptrSpeed = 0;
        }
      } else if (name === "focus") {
        on.focus = arg === true;
      } else if (name === "press") {
        on.press = true;
        const at = arg && typeof arg === "object" ? (arg as { x: number; y: number }) : localPointer();
        Object.assign(ptr, at);
        if (!still) addRipple(at.x, at.y, 1);
      } else if (name === "release") {
        on.press = false;
      }
      settle();
    },

    still() {
      still = true;
      clock = 6.2;
      settle();
    },

    dispose() {
      for (const k of ["lit", "audio", "ripples"]) delete canvas.dataset[k];
      for (const t of targets) {
        gl.deleteFramebuffer(t.fbo);
        gl.deleteTexture(t.tex);
      }
      for (const p of programs) {
        gl.deleteProgram(p.program);
        p.shaders.forEach((s) => gl.deleteShader(s));
      }
      gl.deleteBuffer(vbo);
      gl.deleteVertexArray(vao);
    },
  };
}

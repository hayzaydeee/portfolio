import type { FxContext, FxInstance, RGB, RoomPalette } from "@/components/fx/runtime/types";
import { createProgram, getGL } from "@/components/fx/runtime/gl";
import { mixRGB, resolveToken } from "@/components/fx/runtime/palette";
import { compose, lookAt, multiply, ortho, type Mat4 } from "@/components/fx/runtime/mat4";
import type { LogicCoreOptions } from "./meta";

/**
 * Port of the isometric scene from ThreeUI's Platform Core ("Logic Core", MIT, Meng To), from
 * three 0.136 to raw WebGL. Same scene: an orthographic camera at (20, 20, 20) with a frustum
 * of 12, a dark 16 x 0.5 x 16 platform, a 2 x 4 x 2 emissive core whose light pulses, and
 * data nodes orbiting at radius 4 to 8, a few of them lit like the core. Lighting is the
 * original's ambient + directional + core point light, evaluated per pixel with flat normals.
 */

const MESH_VS = `
attribute vec3 a_pos;
attribute vec3 a_normal;
uniform mat4 u_viewProj;
uniform mat4 u_model;
uniform mat4 u_rot;
varying vec3 v_world;
varying vec3 v_normal;
void main() {
  vec4 world = u_model * vec4(a_pos, 1.0);
  v_world = world.xyz;
  v_normal = (u_rot * vec4(a_normal, 0.0)).xyz;
  gl_Position = u_viewProj * world;
}`;

const MESH_FS = `
precision mediump float;
uniform vec3 u_albedo;
uniform vec3 u_emissive;
uniform vec3 u_dirDir;
uniform vec3 u_pointPos;
uniform vec3 u_pointCol;
uniform float u_pointIntensity;
varying vec3 v_world;
varying vec3 v_normal;
void main() {
  vec3 n = normalize(v_normal);
  float diffuse = max(dot(n, u_dirDir), 0.0) * 0.6;
  vec3 toPoint = u_pointPos - v_world;
  float d = length(toPoint);
  float atten = pow(clamp(1.0 - d / 25.0, 0.0, 1.0), 2.0);
  vec3 point = u_pointCol * u_pointIntensity * atten * max(dot(n, toPoint / max(d, 1e-4)), 0.0);
  vec3 col = u_albedo * (vec3(0.3 + diffuse) + point) + u_emissive;
  gl_FragColor = vec4(col, 1.0);
}`;

const EDGE_VS = `
attribute vec3 a_pos;
uniform mat4 u_viewProj;
uniform mat4 u_model;
void main() { gl_Position = u_viewProj * u_model * vec4(a_pos, 1.0); }`;

const EDGE_FS = `
precision mediump float;
uniform vec4 u_color;
void main() { gl_FragColor = u_color; }`;

/** Unit cube: 36 vertices of position + flat normal */
function cube(): Float32Array {
  const faces: [number[], number[][]][] = [
    [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
    [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
    [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]],
    [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
    [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
    [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
  ];
  const out: number[] = [];
  for (const [n, q] of faces) {
    for (const i of [0, 1, 2, 0, 2, 3]) out.push(q[i][0] * 0.5, q[i][1] * 0.5, q[i][2] * 0.5, ...n);
  }
  return new Float32Array(out);
}

/** The cube's 12 edges as line pairs */
function edges(): Float32Array {
  const c = [-0.5, 0.5];
  const out: number[] = [];
  for (const a of c)
    for (const b of c) {
      out.push(-0.5, a, b, 0.5, a, b);
      out.push(a, -0.5, b, a, 0.5, b);
      out.push(a, b, -0.5, a, b, 0.5);
    }
  return new Float32Array(out);
}

type Body = { size: number; angle: number; radius: number; speed: number; yBase: number; yOffset: number; accent: boolean; rx: number; ry: number };

const hex = (n: number): RGB => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const SOURCE = { base: hex(0x050505), platform: hex(0x111111), node: hex(0x222222), core: hex(0x00e5ff), edge: hex(0x555555) };
const FRUSTUM = 12;

export function create(ctx: FxContext, initial: LogicCoreOptions): FxInstance<LogicCoreOptions> {
  let opts = { ...initial };
  const { canvas } = ctx;
  const gl = getGL(canvas, { depth: true, antialias: true });
  if (!gl) throw new Error("WebGL unavailable");

  const mesh = createProgram(gl, MESH_VS, MESH_FS);
  const line = createProgram(gl, EDGE_VS, EDGE_FS);
  const cubeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, cube(), gl.STATIC_DRAW);
  const edgeBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, edges(), gl.STATIC_DRAW);

  let palette = ctx.palette;
  let colours = { base: SOURCE.base, platform: SOURCE.platform, node: SOURCE.node, core: SOURCE.core, edge: SOURCE.edge };
  let bodies: Body[] = [];
  let time = 0;
  let still = false;
  let aspect = 1;

  const view = lookAt([20, 20, 20], [0, 0, 0], [0, 1, 0]);
  const proj: Mat4 = new Float32Array(16);
  const viewProj: Mat4 = new Float32Array(16);
  const model: Mat4 = new Float32Array(16);
  const rot: Mat4 = new Float32Array(16);
  const group: Mat4 = new Float32Array(16);
  const groupRot: Mat4 = new Float32Array(16);
  const local: Mat4 = new Float32Array(16);
  const localRot: Mat4 = new Float32Array(16);

  const recolour = () => {
    if (opts.sourcePalette) {
      colours = { ...SOURCE };
      return;
    }
    const core = opts.accent ? resolveToken(opts.accent) : palette.glow;
    colours = {
      base: palette.base,
      platform: mixRGB(palette.base, palette.surface, 0.6),
      node: mixRGB(palette.surface, palette.muted, 0.25),
      core,
      edge: palette.muted,
    };
  };

  const populate = () => {
    const n = Math.round(opts.nodes);
    bodies = Array.from({ length: n }, (_, i) => ({
      size: 0.4 + Math.random() * 0.4,
      angle: (i / n) * Math.PI * 2,
      radius: 4 + Math.random() * 4,
      speed: 0.005 + Math.random() * 0.015,
      yBase: -1 + Math.random() * 4,
      yOffset: Math.random() * Math.PI * 2,
      accent: Math.random() > 0.7,
      rx: 0,
      ry: 0,
    }));
  };

  const meshAttribs = () => {
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
    const pos = gl.getAttribLocation(mesh.program, "a_pos");
    const nor = gl.getAttribLocation(mesh.program, "a_normal");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(nor);
    gl.vertexAttribPointer(nor, 3, gl.FLOAT, false, 24, 12);
    return () => {
      gl.disableVertexAttribArray(pos);
      gl.disableVertexAttribArray(nor);
    };
  };

  const placeInGroup = (t: [number, number, number], r: [number, number, number], s: number | [number, number, number]) => {
    compose(t, r, s, local);
    multiply(group, local, model);
    compose([0, 0, 0], r, 1, localRot);
    multiply(groupRot, localRot, rot);
  };

  const draw = () => {
    const pulse = ((Math.sin(time * 2.5) + 1) * 0.5) * opts.pulse;
    const spin = Math.sin(time * 0.1) * 0.15;
    compose([0, Math.sin(time * 0.5) * 0.2, 0], [0, spin, 0], 1, group);
    compose([0, 0, 0], [0, spin, 0], 1, groupRot);
    ortho(-FRUSTUM * aspect, FRUSTUM * aspect, -FRUSTUM, FRUSTUM, 1, 1000, proj);
    multiply(proj, view, viewProj);

    gl.enable(gl.DEPTH_TEST);
    // Edges sit exactly on the faces they outline: let equal depths through
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(colours.base[0], colours.base[1], colours.base[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(mesh.program);
    gl.uniformMatrix4fv(mesh.uniform("u_viewProj"), false, viewProj);
    const dir = [10, 20, 5];
    const len = Math.hypot(dir[0], dir[1], dir[2]);
    gl.uniform3f(mesh.uniform("u_dirDir"), dir[0] / len, dir[1] / len, dir[2] / len);
    // The core's light rides with the group
    gl.uniform3f(mesh.uniform("u_pointPos"), group[12], 1 + group[13], group[14]);
    gl.uniform3fv(mesh.uniform("u_pointCol"), colours.core);
    gl.uniform1f(mesh.uniform("u_pointIntensity"), 1 + pulse * 1.5);
    const off = meshAttribs();
    const glow = 0.4 + pulse * 0.6;
    const emissive: RGB = [colours.core[0] * glow * 0.5, colours.core[1] * glow * 0.5, colours.core[2] * glow * 0.5];

    const solid = (albedo: RGB, lit: boolean) => {
      gl.uniformMatrix4fv(mesh.uniform("u_model"), false, model);
      gl.uniformMatrix4fv(mesh.uniform("u_rot"), false, rot);
      gl.uniform3fv(mesh.uniform("u_albedo"), albedo);
      gl.uniform3fv(mesh.uniform("u_emissive"), lit ? emissive : [0, 0, 0]);
      gl.drawArrays(gl.TRIANGLES, 0, 36);
    };

    placeInGroup([0, -2, 0], [0, 0, 0], [16, 0.5, 16]);
    solid(colours.platform, false);
    const platformModel = new Float32Array(model);
    placeInGroup([0, 0.25, 0], [0, 0, 0], [2, 4, 2]);
    solid(colours.core, true);
    const nodeModels: Float32Array[] = [];
    for (const b of bodies) {
      placeInGroup([Math.cos(b.angle) * b.radius, b.yBase + Math.sin(time * 1.5 + b.yOffset) * 0.5, Math.sin(b.angle) * b.radius], [b.rx, b.ry, 0], b.size);
      solid(b.accent ? colours.core : colours.node, b.accent);
      nodeModels.push(new Float32Array(model));
    }
    off();

    // Wireframe edges: the platform's at 0.4, the nodes' at 0.3
    gl.useProgram(line.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniformMatrix4fv(line.uniform("u_viewProj"), false, viewProj);
    gl.bindBuffer(gl.ARRAY_BUFFER, edgeBuffer);
    const pos = gl.getAttribLocation(line.program, "a_pos");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 12, 0);
    const edge = (m: Float32Array, a: number) => {
      gl.uniformMatrix4fv(line.uniform("u_model"), false, m);
      gl.uniform4f(line.uniform("u_color"), colours.edge[0], colours.edge[1], colours.edge[2], a);
      gl.drawArrays(gl.LINES, 0, 24);
    };
    edge(platformModel, 0.4);
    for (const m of nodeModels) edge(m, 0.3);
    gl.disableVertexAttribArray(pos);
    gl.disable(gl.BLEND);
  };

  const advance = (frames: number) => {
    time += 0.016 * frames * opts.speed;
    for (const b of bodies) {
      b.angle += b.speed * frames * opts.speed;
      b.rx += 0.01 * frames * opts.speed;
      b.ry += 0.02 * frames * opts.speed;
    }
  };

  recolour();
  populate();

  return {
    resize(w, h, pr) {
      aspect = Math.max(1, w) / Math.max(1, h);
      canvas.width = Math.max(1, Math.round(w * pr));
      canvas.height = Math.max(1, Math.round(h * pr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (still) draw();
    },

    render(_now, dt) {
      advance(Math.min(50, dt) / 16.67);
      draw();
    },

    update(next) {
      const repopulate = next.nodes !== undefined && Math.round(next.nodes) !== Math.round(opts.nodes);
      opts = { ...opts, ...next };
      recolour();
      if (repopulate) populate();
      if (still) draw();
    },

    setPalette(next: RoomPalette) {
      palette = next;
      recolour();
      if (still) draw();
    },

    still() {
      still = true;
      time = 1.2;
      draw();
    },

    dispose() {
      gl.deleteBuffer(cubeBuffer);
      gl.deleteBuffer(edgeBuffer);
      mesh.dispose();
      line.dispose();
    },
  };
}

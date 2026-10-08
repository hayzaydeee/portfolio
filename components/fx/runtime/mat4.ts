/**
 * The handful of column-major 4x4 matrix operations the raw-WebGL 3D effects need (projection,
 * view, model), so no effect has to pull in three for a camera.
 */

export type Mat4 = Float32Array;

export const identity = (): Mat4 => {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
};

export function multiply(a: Mat4, b: Mat4, out: Mat4 = new Float32Array(16)): Mat4 {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

export function perspective(fovYDeg: number, aspect: number, near: number, far: number, out: Mat4 = new Float32Array(16)): Mat4 {
  const f = 1 / Math.tan((fovYDeg * Math.PI) / 360);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function ortho(left: number, right: number, bottom: number, top: number, near: number, far: number, out: Mat4 = new Float32Array(16)): Mat4 {
  out.fill(0);
  out[0] = 2 / (right - left);
  out[5] = 2 / (top - bottom);
  out[10] = -2 / (far - near);
  out[12] = -(right + left) / (right - left);
  out[13] = -(top + bottom) / (top - bottom);
  out[14] = -(far + near) / (far - near);
  out[15] = 1;
  return out;
}

export function lookAt(eye: [number, number, number], target: [number, number, number], up: [number, number, number], out: Mat4 = new Float32Array(16)): Mat4 {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len;
  zy /= len;
  zz /= len;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  len = Math.hypot(xx, xy, xz) || 1;
  xx /= len;
  xy /= len;
  xz /= len;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  out[0] = xx;
  out[1] = yx;
  out[2] = zx;
  out[3] = 0;
  out[4] = xy;
  out[5] = yy;
  out[6] = zy;
  out[7] = 0;
  out[8] = xz;
  out[9] = yz;
  out[10] = zz;
  out[11] = 0;
  out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  out[15] = 1;
  return out;
}

/** Translate, then rotate X, Y, Z (in that order applied to the object), then scale */
export function compose(
  t: [number, number, number],
  r: [number, number, number],
  s: number | [number, number, number],
  out: Mat4 = new Float32Array(16)
): Mat4 {
  const [sx, sy, sz] = typeof s === "number" ? [s, s, s] : s;
  const cx = Math.cos(r[0]);
  const sxr = Math.sin(r[0]);
  const cy = Math.cos(r[1]);
  const syr = Math.sin(r[1]);
  const cz = Math.cos(r[2]);
  const szr = Math.sin(r[2]);
  // R = Rz * Ry * Rx
  const m00 = cz * cy;
  const m01 = cz * syr * sxr - szr * cx;
  const m02 = cz * syr * cx + szr * sxr;
  const m10 = szr * cy;
  const m11 = szr * syr * sxr + cz * cx;
  const m12 = szr * syr * cx - cz * sxr;
  const m20 = -syr;
  const m21 = cy * sxr;
  const m22 = cy * cx;
  out[0] = m00 * sx;
  out[1] = m10 * sx;
  out[2] = m20 * sx;
  out[3] = 0;
  out[4] = m01 * sy;
  out[5] = m11 * sy;
  out[6] = m21 * sy;
  out[7] = 0;
  out[8] = m02 * sz;
  out[9] = m12 * sz;
  out[10] = m22 * sz;
  out[11] = 0;
  out[12] = t[0];
  out[13] = t[1];
  out[14] = t[2];
  out[15] = 1;
  return out;
}

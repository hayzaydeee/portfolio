/**
 * ThreeUI Liquid Form's Velox shaders (MIT, Meng To), moved from a ray-marcher onto a mesh.
 * The original marched a sphere of radius 1.8 whose distance was pushed in and out by three
 * octaves of simplex noise; here the noise pushes an icosphere's vertices by the same amount
 * along their normals, and each vertex finds its bent normal from two displaced neighbours.
 * The fragment shader is the original's: its studio environment read along the reflected ray,
 * fresnel, a hard specular, the shading that darkens the swells, and its tone curve.
 */

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

export const FORM_VERTEX = `
uniform float uTime;
uniform float uMorph;
uniform float uNoiseScale;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vDisp;
${NOISE}
const float RADIUS = 1.8;

// The original's displacement of the distance field at p
float morphAt(vec3 p){
  float m = snoise(p * (0.8 * uNoiseScale) + uTime * 0.1) * 0.2;
  m += snoise(p * (1.5 * uNoiseScale) - uTime * 0.05 + 10.0) * 0.08;
  m += snoise(p * (3.0 * uNoiseScale) + uTime * 0.02) * 0.02;
  return m * uMorph;
}

// length(p) - R + morph = 0 puts the surface at R - morph along each direction
vec3 surfaceAt(vec3 dir){ return dir * (RADIUS - morphAt(dir * RADIUS)); }

void main(){
  vec3 n = normalize(position);
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  const float E = 0.01;
  vec3 p0 = surfaceAt(n);
  vec3 p1 = surfaceAt(normalize(n + t1 * E));
  vec3 p2 = surfaceAt(normalize(n + t2 * E));
  vec3 bent = normalize(cross(p1 - p0, p2 - p0));
  if (dot(bent, n) < 0.0) bent = -bent;

  vDisp = morphAt(n * RADIUS);
  vec4 world = modelMatrix * vec4(p0, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * bent);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const FORM_FRAGMENT = `
uniform vec2 uMouse;
uniform float uMetal;
uniform vec3 uAmbient;
uniform vec3 uKey;
uniform vec3 uRimLight;
uniform vec3 uFill;
uniform vec3 uPanel;
uniform vec3 uSpec;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vDisp;

vec3 envLighting(vec3 rd, vec2 mouse) {
  vec3 col = uAmbient;
  vec3 keyDir = normalize(vec3(0.5 + mouse.x, 1.0 + mouse.y * 0.5, 1.2));
  float key = pow(max(dot(rd, keyDir), 0.0), 12.0);
  col += uKey * key * 1.5;
  vec3 rimDir = normalize(vec3(-0.8, -0.2, -1.0));
  float rim = pow(max(dot(rd, rimDir), 0.0), 6.0);
  col += uRimLight * rim * 0.8;
  vec3 fillDir = normalize(vec3(-1.0, 0.5, 0.5));
  float fill = pow(max(dot(rd, fillDir), 0.0), 3.0);
  col += uFill * fill * 0.6;
  float panel = exp(-pow((rd.y - 0.2) * 4.0, 2.0)) * smoothstep(-0.5, 0.5, rd.z);
  col += uPanel * panel;
  return col;
}

void main(){
  vec3 n = normalize(vWorldNormal);
  vec3 rd = normalize(vWorldPos - cameraPosition);
  vec3 ref = reflect(rd, n);
  float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
  fresnel = mix(0.4, 1.0, fresnel);
  vec3 col = envLighting(ref, uMouse) * fresnel * 1.8 * uMetal;
  vec3 lightPos = normalize(vec3(0.5 + uMouse.x, 1.0, 1.0));
  float spec = pow(max(dot(ref, lightPos), 0.0), 60.0);
  col += uSpec * spec * 2.0 * uMetal;
  // as in the original, where the surface swells outward it sits darker
  col *= mix(0.7, 1.0, smoothstep(-0.1, 0.1, vDisp));
  col = col / (col + 0.5);
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, 1.0);
}`;

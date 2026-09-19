/**
 * GLSL sources. Everything visual is procedural: 3D simplex noise (Ashima
 * Arts / Stefan Gustavson, MIT) drives granulation, convection cells,
 * ejecta clumping and filaments. No textures are loaded.
 */

export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p) {
  float f = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    f += a * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return f;
}
`;

// ---------------------------------------------------------------- star surface

export const STAR_VERT = /* glsl */ `
${NOISE_GLSL}
uniform float uTime;
uniform float uInstability;
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vWorldPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPos = position;
  vec3 p = position;
  // Surface heaving: convective pulsation plus the violent shudder of the final seconds.
  float heave = snoise(position * 2.5 + vec3(uTime * 0.12)) * (0.004 + 0.012 * uInstability);
  p += normal * heave;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const STAR_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uColor;
uniform float uTime;
uniform float uGranuleScale;
uniform float uTurbulence;
uniform float uInstability;
uniform float uBrightness;
uniform float uFlash;
uniform float uOpacity;
uniform vec3 uCamPos;
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vWorldPos;
void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(uCamPos - vWorldPos);
  float mu = clamp(dot(n, viewDir), 0.0, 1.0);
  // Eddington limb darkening: I(mu)/I(1) ≈ 0.4 + 0.6 mu
  float limb = 0.35 + 0.65 * mu;
  float t = uTime * 0.07;
  vec3 p = vPos * uGranuleScale;
  float granules = fbm(p + vec3(t, -t * 0.7, t * 0.3));
  float cells = fbm(p * 0.28 + vec3(-t * 0.35, t * 0.2, 0.0));
  float pattern = mix(granules, cells, uTurbulence);
  float bright = 0.5 + 0.7 * pattern;
  float faculae = pow(max(0.0, pattern), 3.0) * 0.7;
  // Instability: hot cracks and flicker as the shock nears the surface
  float crack = pow(max(0.0, fbm(vPos * 7.0 + vec3(0.0, t * 6.0, 0.0))), 6.0) * uInstability * 4.0;
  float flicker = 1.0 + uInstability * 0.2 * sin(uTime * 19.0 + pattern * 25.0);
  vec3 col = uColor * (bright + faculae) * limb * flicker;
  col += vec3(1.0, 0.92, 0.8) * crack;
  col *= uBrightness;
  // Shock breakout: the whole surface flashes at >100,000 K
  col = mix(col, vec3(1.35, 1.3, 1.25) * (2.0 + 8.0 * uFlash), clamp(uFlash * 1.5, 0.0, 1.0));
  gl_FragColor = vec4(col, uOpacity);
}
`;

// ---------------------------------------------------------------- billboard glow

export const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uFalloff;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = pow(max(0.0, 1.0 - r), uFalloff);
  gl_FragColor = vec4(uColor * uIntensity * a, a);
}
`;

// ---------------------------------------------------------------- fresnel shell (shock, chromosphere)

export const SHELL_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vWorldPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const SHELL_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform vec3 uColor;
uniform float uStrength;
uniform float uTime;
uniform float uFilament;
uniform float uPower;
uniform vec3 uCamPos;
varying vec3 vNormal;
varying vec3 vPos;
varying vec3 vWorldPos;
void main() {
  float mu = abs(dot(normalize(vNormal), normalize(uCamPos - vWorldPos)));
  float rim = pow(1.0 - mu, uPower);
  // Filamentary structure (Rayleigh–Taylor fingers) grows as the remnant ages
  float fil = 0.5 + 0.5 * fbm(vPos * 4.0 + vec3(uTime * 0.01));
  float f = mix(1.0, clamp(fil * 1.6, 0.0, 1.5), uFilament);
  float a = rim * uStrength * f + (1.0 - rim) * uStrength * 0.05 * f;
  gl_FragColor = vec4(uColor * a, a);
}
`;

// ---------------------------------------------------------------- ejecta particles

export const EJECTA_VERT = /* glsl */ `
${NOISE_GLSL}
attribute vec3 dir;
attribute float speed;
attribute float seed;
attribute float layer;
uniform float uT;
uniform float uR0;
uniform float uVmax;
uniform float uRadiusScale;
uniform float uClump;
uniform float uScreenH;
uniform float uFovFactor;
uniform float uSizeFactor;
uniform float uNebular;
varying float vAlpha;
varying float vSeed;
varying float vLayer;
void main() {
  // Homologous expansion: r = r0 + v t, faster material stays outside
  float r = (uR0 * 0.92 + speed * uVmax * uT) * uRadiusScale;
  vec3 nz = vec3(snoise(dir * 2.5 + seed), snoise(dir * 2.5 + seed + 10.0), snoise(dir * 2.5 + seed + 20.0));
  vec3 d = normalize(dir + nz * 0.3 * uClump);
  float rr = r * (1.0 + 0.15 * uClump * snoise(dir * 4.0 + seed));
  vec3 pos = d * rr;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float dist = max(-mv.z, 1e-12);
  float chunk = rr * (0.045 + 0.09 * (1.0 - speed)) * uSizeFactor;
  float px = chunk / dist * uFovFactor * uScreenH;
  gl_PointSize = clamp(px, 1.0, 320.0);
  // Dilution as the shell expands (surface brightness ∝ column density)
  float dilute = clamp(pow(uR0 / max(rr, 1e-12), 0.45), 0.10, 1.0);
  float pxFade = smoothstep(0.5, 2.5, px);
  // Nebular boost: the transparent remnant shell glows by line emission, not by dilution of the fireball
  vAlpha = dilute * (1.0 + 12.0 * uNebular) * pxFade * (0.55 + 0.45 * speed);
  vSeed = seed;
  vLayer = layer;
  gl_Position = projectionMatrix * mv;
}
`;

export const EJECTA_FRAG = /* glsl */ `
uniform vec3 uHotColor;
uniform vec3 uOuterColor;
uniform vec3 uInnerColor;
uniform float uNebular;
uniform float uGlow;
varying float vAlpha;
varying float vSeed;
varying float vLayer;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
  float soft = pow(1.0 - r2, 2.2);
  float rnd = fract(sin(vSeed * 12.9898) * 43758.5453);
  float tex = 0.25 + 0.95 * rnd * rnd; // strong brightness variation → clumpy, not foggy
  vec3 cool = vLayer > 0.5 ? uInnerColor : uOuterColor;
  vec3 col = mix(uHotColor, cool, uNebular);
  float a = soft * tex * vAlpha * uGlow;
  gl_FragColor = vec4(col, a);
}
`;

// ---------------------------------------------------------------- pulsar beam cone

export const BEAM_VERT = /* glsl */ `
varying float vY;
void main() {
  vY = position.y; // cone: -0.5 (tip at star) .. 0.5 (far end)
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying float vY;
void main() {
  float along = clamp(vY + 0.5, 0.0, 1.0); // 1 at the tip (on the star), 0 at the far end
  float a = pow(along, 1.6) * uIntensity;
  gl_FragColor = vec4(uColor * a, a);
}
`;

// ---------------------------------------------------------------- accretion disk

export const DISK_VERT = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const DISK_FRAG = /* glsl */ `
${NOISE_GLSL}
uniform float uInner;
uniform float uOuter;
uniform float uTime;
uniform float uIntensity;
varying vec3 vPos;
void main() {
  float r = length(vPos.xy);
  float f = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
  float ang = atan(vPos.y, vPos.x);
  // Keplerian shear: inner streaks rotate faster
  float streaks = 0.65 + 0.35 * snoise(vec3(ang * 3.0 + uTime * (2.5 - 2.0 * f), f * 7.0, 0.0));
  float bright = pow(1.0 - f, 2.2) * streaks * uIntensity;
  vec3 col = mix(vec3(1.0, 0.96, 0.9), vec3(1.0, 0.4, 0.08), f);
  gl_FragColor = vec4(col * bright * 2.5, bright);
}
`;

// ---------------------------------------------------------------- background stars

export const STARFIELD_VERT = /* glsl */ `
attribute float size;
attribute vec3 tint;
varying vec3 vTint;
varying float vSize;
void main() {
  vTint = tint;
  vSize = size;
  gl_PointSize = size;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const STARFIELD_FRAG = /* glsl */ `
varying vec3 vTint;
varying float vSize;
uniform float uBrightness;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r2 = dot(c, c) * 4.0;
  if (r2 > 1.0) discard;
  float a = pow(1.0 - r2, 1.5) * uBrightness * min(1.0, vSize * 0.5);
  gl_FragColor = vec4(vTint * a, a);
}
`;

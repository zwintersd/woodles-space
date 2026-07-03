import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

let quietRoomStarted = false;

export function initQuietRoom() {
if (quietRoomStarted) return () => {};
quietRoomStarted = true;

/* Surface a missing canvas instead of a silent black screen. */
function fallback(msg) {
  const box = document.getElementById('fallback');
  if (msg) document.getElementById('fallback-msg').textContent = msg;
  box.classList.add('show');
}
/* If a runtime script fails before the room is ready, surface it instead of
   leaving a silent black screen. */
window.addEventListener('error', (e) => {
  if (e.target && e.target.tagName === 'SCRIPT' && !document.body.classList.contains('ready')) {
    fallback('the room’s libraries could not load — check your connection, then refresh.');
  }
}, true);

const body = document.body;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PAPER_SHADER_EVENT = 'quiet-room:paper-shader';
const paperLayer = document.getElementById('paper-shader');
let lastShaderSignature = '';
let still = false;

/* ── moods ──────────────────────────────────────────────────────────
   each is a held breath of colour the whole room lerps toward. */
const MOODS = [
  { name: 'dusk',    fog: 0x130f20, light: 0xb6a4ff, core: 0xe2d4ff, mote: 0xc9bfee, beam: 0xb0a0ff, ground: 0x0b0913 },
  { name: 'ember',   fog: 0x1a1310, light: 0xff9a64, core: 0xffd2a4, mote: 0xf6caa6, beam: 0xff9a64, ground: 0x140d09 },
  { name: 'tide',    fog: 0x0a1620, light: 0x6fd8d4, core: 0xb2f0ea, mote: 0x8eddd4, beam: 0x6fd8d4, ground: 0x07111a },
  { name: 'rose',    fog: 0x1c1218, light: 0xff96b8, core: 0xffc8da, mote: 0xeab0c8, beam: 0xff96b8, ground: 0x140b10 },
  { name: 'moss',    fog: 0x0d160e, light: 0x9fd884, core: 0xceeab0, mote: 0xa6c08e, beam: 0x9fd884, ground: 0x080f08 },
  { name: 'pearl',   fog: 0x171a24, light: 0xcdd6ff, core: 0xf2f4ff, mote: 0xd6dcf2, beam: 0xc4cdf0, ground: 0x0c0e16 },
];
const VISUALS_KEY = 'quiet-room.visuals.v1';
const DEFAULT_VISUALS = Object.freeze({
  wash: 0.55,
  warp: 0.44,
  grain: 0.34,
  drift: 0.42,
  zoom: 0.46,
  spark: 0.52,
  trail: 0.36,
});
const savedVisualState = readVisualState();
let moodIdx = savedMoodIndex(savedVisualState.moodIdx);
const visuals = {
  wash: readVisualValue(savedVisualState.wash, DEFAULT_VISUALS.wash),
  warp: readVisualValue(savedVisualState.warp, DEFAULT_VISUALS.warp),
  grain: readVisualValue(savedVisualState.grain, DEFAULT_VISUALS.grain),
  drift: readVisualValue(savedVisualState.drift, DEFAULT_VISUALS.drift),
  zoom: readVisualValue(savedVisualState.zoom, DEFAULT_VISUALS.zoom),
  spark: readVisualValue(savedVisualState.spark, DEFAULT_VISUALS.spark),
  trail: readVisualValue(savedVisualState.trail, DEFAULT_VISUALS.trail),
};
/* working colours, lerped toward the active mood each frame */
const cur = {
  fog:    new THREE.Color(MOODS[moodIdx].fog),
  light:  new THREE.Color(MOODS[moodIdx].light),
  core:   new THREE.Color(MOODS[moodIdx].core),
  mote:   new THREE.Color(MOODS[moodIdx].mote),
  beam:   new THREE.Color(MOODS[moodIdx].beam),
  ground: new THREE.Color(MOODS[moodIdx].ground),
};

function readVisualState() {
  try { return JSON.parse(localStorage.getItem(VISUALS_KEY) || '{}') || {}; }
  catch (_) { return {}; }
}
function readVisualValue(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? clamp01(n) : fallback;
}
function savedMoodIndex(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return ((Math.round(n) % MOODS.length) + MOODS.length) % MOODS.length;
}
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}
function saveVisualState() {
  try { localStorage.setItem(VISUALS_KEY, JSON.stringify({ moodIdx, ...visuals })); }
  catch (_) {}
}
function moodHex(value) {
  return '#' + new THREE.Color(value).getHexString();
}
function paperShaderSignature() {
  return [moodIdx, visuals.wash, visuals.warp, visuals.grain, visuals.drift, visuals.zoom, still]
    .map((value) => typeof value === 'number' ? value.toFixed(3) : value)
    .join(':');
}
function paperShaderSpeed() {
  return reduced || still ? 0 : 0.03 + visuals.drift * 0.27;
}
function paperShaderProps(mood) {
  return {
    colors: [mood.light, mood.core, mood.beam, mood.mote, mood.ground].map(moodHex),
    distortion: 0.24 + visuals.warp * 0.76,
    swirl: 0.08 + visuals.warp * 0.58,
    grainMixer: visuals.grain * 0.38,
    grainOverlay: visuals.grain * 0.3,
    fit: 'cover',
    rotation: (visuals.warp - 0.5) * 12,
    scale: 0.94 + visuals.zoom * 0.86,
    offsetX: 0,
    offsetY: -0.08 + visuals.zoom * 0.08,
    originX: 0.5,
    originY: 0.5,
    worldWidth: window.innerWidth,
    worldHeight: window.innerHeight,
    speed: paperShaderSpeed(),
  };
}
function updatePaperShader(force = false) {
  const signature = paperShaderSignature();
  if (!force && lastShaderSignature === signature) return;
  const detail = paperShaderProps(MOODS[moodIdx]);
  window.__quietRoomPaperShader = detail;
  window.dispatchEvent(new CustomEvent(PAPER_SHADER_EVENT, { detail }));
  lastShaderSignature = signature;
}
function syncPaperShaderSpeed() {
  updatePaperShader(true);
}
function applyPaperStyle() {
  if (!paperLayer) return;
  const rest = 0.08 + visuals.wash * 0.36;
  const play = Math.min(0.58, rest + 0.055 + visuals.warp * 0.055);
  const kick = Math.min(0.72, play + 0.1 + visuals.wash * 0.08);
  paperLayer.style.setProperty('--paper-rest-opacity', rest.toFixed(3));
  paperLayer.style.setProperty('--paper-play-opacity', play.toFixed(3));
  paperLayer.style.setProperty('--paper-kick-opacity', kick.toFixed(3));
  paperLayer.style.setProperty('--paper-blur', (10 + (1 - visuals.grain) * 18).toFixed(1) + 'px');
  paperLayer.style.setProperty('--paper-saturation', (1 + visuals.wash * 0.48).toFixed(2));
}
function applySparkStyle() {
  document.getElementById('spark-layer')?.style.setProperty(
    '--spark-opacity',
    (0.24 + visuals.spark * 0.76).toFixed(2),
  );
}
applyPaperStyle();
applySparkStyle();
updatePaperShader(true);

/* ── renderer / scene / camera ─────────────────────────────────────── */
const canvas = document.getElementById('room');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  fallback();
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;

const scene = new THREE.Scene();
scene.background = cur.fog.clone();
scene.fog = new THREE.FogExp2(cur.fog.clone(), 0.072);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 60);
const camHome = new THREE.Vector3(0, 1.45, 6.4);
camera.position.copy(camHome);
const lookTarget = new THREE.Vector3(0, 1.25, 0);

/* ── the room: a soft floor that dissolves into fog ─────────────────── */
const floorMat = new THREE.MeshStandardMaterial({
  color: cur.ground.clone(),
  roughness: 0.62,
  metalness: 0.34,
});
const floor = new THREE.Mesh(new THREE.CircleGeometry(34, 96), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.04;
scene.add(floor);

/* ── a reflecting pool: the heart, beam and motes mirrored in the stone,
   faded out toward the rim so there's no hard horizon. additive and dim,
   a wet sheen rather than a mirror. kept linear — the composer tone-maps. */
const REFL_R = 34;
const reflShader = {
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uStrength: { value: 0.9 },
  },
  vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying float vR;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vR = length(position.xy) / ${REFL_R.toFixed(1)};
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec4 vUv;
    varying float vR;
    void main() {
      vec4 base = texture2DProj(tDiffuse, vUv);
      float fade = smoothstep(1.0, 0.25, vR);     /* bright centre, gone by the rim */
      gl_FragColor = vec4(base.rgb * color * uStrength, fade);
    }`,
};
let reflector = null;
try {
  const rdpr = renderer.getPixelRatio();
  reflector = new Reflector(new THREE.CircleGeometry(REFL_R, 96), {
    clipBias: 0.003,
    textureWidth: Math.max(256, Math.floor(window.innerWidth * rdpr * 0.5)),
    textureHeight: Math.max(256, Math.floor(window.innerHeight * rdpr * 0.5)),
    color: 0x6a6d82,
    shader: reflShader,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = -0.018;
  reflector.material.transparent = true;
  reflector.material.depthWrite = false;
  reflector.material.blending = THREE.AdditiveBlending;
  scene.add(reflector);
} catch (_) { reflector = null; }

/* a faint ring of standing stones — just suggestions of walls */
const pillarGroup = new THREE.Group();
const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0d0b16, roughness: 0.9, metalness: 0.1 });
const PILLARS = 9, ringR = 9.5;
for (let i = 0; i < PILLARS; i++) {
  const a = (i / PILLARS) * Math.PI * 2;
  const h = 5.2 + Math.sin(i * 1.7) * 0.9;
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, h, 10), pillarMat);
  p.position.set(Math.cos(a) * ringR, h / 2 - 0.4, Math.sin(a) * ringR);
  pillarGroup.add(p);
}
scene.add(pillarGroup);

/* ── the centrepiece: a slow, breathing geode of light ──────────────── */
const heart = new THREE.Group();
heart.position.copy(lookTarget);
scene.add(heart);

/* inner glow — small and soft, a held ember rather than a hotspot */
const coreMat = new THREE.MeshBasicMaterial({ color: cur.core.clone() });
const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 2), coreMat);
heart.add(core);

/* faceted shell catching the inner light */
const shellMat = new THREE.MeshStandardMaterial({
  color: 0x1a1430,
  emissive: cur.core.clone(),
  emissiveIntensity: 0.35,
  roughness: 0.18,
  metalness: 0.55,
  transparent: true,
  opacity: 0.78,
  flatShading: true,
});
const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), shellMat);
heart.add(shell);

/* a hairline wireframe over the shell for structure */
const wire = new THREE.LineSegments(
  new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.62, 1)),
  new THREE.LineBasicMaterial({ color: cur.core.clone(), transparent: true, opacity: 0.22 }),
);
heart.add(wire);

/* a halo disc behind the heart, additive, for a soft aura */
const halo = new THREE.Mesh(
  new THREE.CircleGeometry(1.05, 64),
  new THREE.MeshBasicMaterial({
    color: cur.core.clone(), transparent: true, opacity: 0.14,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }),
);
halo.position.copy(lookTarget);
scene.add(halo);

/* the light that lives inside the heart — gentle, so the aurora can lead */
const coreLight = new THREE.PointLight(cur.light.clone(), 9, 24, 1.7);
coreLight.position.copy(lookTarget);
scene.add(coreLight);
scene.add(new THREE.AmbientLight(0x262642, 0.6));
const fill = new THREE.DirectionalLight(0x6a5a9a, 0.32);
fill.position.set(3, 6, 4);
scene.add(fill);

/* ── the shaft of light from above ──────────────────────────────────── */
const beamMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
  uniforms: { uColor: { value: cur.beam.clone() }, uOpacity: { value: 0.038 } },
  vertexShader: `
    varying float vY;
    void main() {
      vY = uv.y;                       /* 0 at the base, 1 at the top */
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    varying float vY;
    uniform vec3 uColor;
    uniform float uOpacity;
    void main() {
      float edge = smoothstep(0.0, 0.35, vY) * (1.0 - smoothstep(0.55, 1.0, vY));
      gl_FragColor = vec4(uColor, edge * uOpacity);
    }`,
});
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 2.4, 9, 40, 1, true), beamMat);
beam.position.set(0, 5.4, 0);
scene.add(beam);

/* ── the aurora: the room's true light ───────────────────────────────────
   an enveloping curtain of pastel-rainbow light in the far sky, woven from
   value-noise. it breathes and slides, hues drift round the wheel, and the
   active mood tints the whole sheet. fog is off so it reads as distant sky;
   the pillars stand as silhouettes against it. */
const auroraMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  side: THREE.BackSide,
  fog: false,
  uniforms: {
    uTime: { value: 0 },
    uMood: { value: cur.light.clone() },
    uMoodMix: { value: 0.32 },
    uIntensity: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime, uMoodMix, uIntensity;
    uniform vec3 uMood;
    vec3 hsl2rgb(vec3 c) {
      vec3 r = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return c.z + c.y * (r - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.0 + 11.3; a *= 0.5; }
      return v;
    }
    void main() {
      float x = vUv.x, y = vUv.y;
      float t = uTime * 0.04;
      float warp = fbm(vec2(x * 3.0 + t, y * 1.5 - t * 0.3));           /* slow drift */
      float rays = fbm(vec2(x * 16.0 - t * 1.2, y * 1.2 + warp * 1.4)); /* vertical streaks */
      rays = pow(clamp(rays, 0.0, 1.0), 1.8);
      float wash = fbm(vec2(x * 2.0 + t * 0.5, y + warp));              /* broad soft sheet */
      float washEnv = smoothstep(0.22, 0.5, y) * (1.0 - smoothstep(0.72, 1.05, y));
      float curtEnv = smoothstep(0.34, 0.58, y) * (1.0 - smoothstep(0.82, 1.02, y));
      float a = (wash * 0.14 * washEnv + rays * 0.4 * curtEnv) * uIntensity;
      float hue = fract(x * 0.7 + warp * 0.28 + uTime * 0.015);
      vec3 col = hsl2rgb(vec3(hue, 0.45, 0.72));
      col = mix(col, uMood, uMoodMix);
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * 0.6);
    }`,
});
const aurora = new THREE.Mesh(new THREE.CylinderGeometry(22, 22, 40, 96, 1, true), auroraMat);
aurora.position.y = 8;
scene.add(aurora);

/* ── dust motes adrift in the light ─────────────────────────────────────
   round, soft, pastel-rainbow points. drawn in a shader so the glow is a
   true circle — no boxy sprite edge — and every mote owns its own hue and
   a slow twinkle. the whole field eases its hues round the wheel over time. */
const MOTE_VERT = `
  attribute float aHue;
  attribute float aPhase;
  attribute float aScale;
  uniform float uTime;
  uniform float uSize;
  uniform float uScale;        /* 0.5 * drawing-buffer height */
  varying float vHue;
  varying float vTw;
  void main() {
    vHue = aHue;
    float tw = 0.55 + 0.45 * sin(uTime * 1.3 + aPhase * 6.2831853);
    vTw = tw;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float sz = uSize * aScale * (0.75 + 0.4 * tw);
    gl_PointSize = clamp(sz * uScale / -mv.z, 0.0, 180.0);
  }`;
const MOTE_FRAG = `
  precision mediump float;
  uniform float uHueShift;
  uniform float uOpacity;
  uniform float uMoodMix;
  uniform vec3 uMood;
  varying float vHue;
  varying float vTw;
  vec3 hsl2rgb(vec3 c) {
    vec3 r = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (r - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(uv));   /* soft round disc */
    a *= a;                                        /* bright core, gentle halo */
    vec3 col = hsl2rgb(vec3(fract(vHue + uHueShift), 0.5, 0.78));
    col = mix(col, uMood, uMoodMix);               /* a touch of the mood, for cohesion */
    gl_FragColor = vec4(col, a * uOpacity * vTw);
  }`;
const moteScale = () => renderer.domElement.height * 0.5;

function makeMotes(count, spread, height, size, opacity, moodMix) {
  const pos = new Float32Array(count * 3);
  const hue = new Float32Array(count);
  const phase = new Float32Array(count);
  const scl = new Float32Array(count);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = Math.pow(Math.random(), 0.7) * spread;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3]     = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * height;
    pos[i * 3 + 2] = Math.sin(a) * r;
    hue[i]   = Math.random();
    phase[i] = Math.random();
    scl[i]   = 0.6 + Math.random() * 0.85;
    seed[i]  = Math.random() * 1000;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aHue', new THREE.BufferAttribute(hue, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aScale', new THREE.BufferAttribute(scl, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG,
    uniforms: {
      uTime: { value: 0 }, uSize: { value: size }, uScale: { value: moteScale() },
      uHueShift: { value: 0 }, uOpacity: { value: opacity },
      uMood: { value: cur.mote.clone() }, uMoodMix: { value: moodMix },
    },
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData = { seed, height };
  scene.add(pts);
  return pts;
}
const motes = makeMotes(reduced ? 280 : 560, 9, 8.5, 0.13, 0.95, 0.18);
const bokeh = makeMotes(reduced ? 44 : 96, 7, 6.5, 0.58, 0.30, 0.10); // big, faint, near

/* ── shooting stars: rare, gentle streaks across the far sky ─────────── */
function streakTexture() {
  const w = 32, h = 160, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.filter = 'blur(2px)';
  const lg = g.createLinearGradient(0, 0, 0, h);     // bright head → fading tail
  lg.addColorStop(0.0, 'rgba(255,255,255,0.95)');
  lg.addColorStop(0.12, 'rgba(255,255,255,0.6)');
  lg.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = lg;
  g.fillRect(w / 2 - 3, 0, 6, h);
  g.filter = 'none';
  const head = g.createRadialGradient(w / 2, 9, 0, w / 2, 9, 9);
  head.addColorStop(0, 'rgba(255,255,255,1)');
  head.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = head;
  g.beginPath(); g.arc(w / 2, 9, 9, 0, Math.PI * 2); g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const stars = [];
if (!reduced) {
  const streakTex = streakTexture();
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.SpriteMaterial({
      map: streakTex, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xeae6ff,
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.34, 2.4, 1);
    sp.visible = false;
    scene.add(sp);
    stars.push({ sp, life: 1, dur: 1, vx: 0, vy: 0 });   // start spent (available)
  }
}
let nextStar = 4 + Math.random() * 6;
function launchStar() {
  const s = stars.find((s) => s.life >= s.dur);
  if (!s) return;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const y = 7 + Math.random() * 7;
  const z = -6 - Math.random() * 9;
  s.sp.position.set(-16 * dir, y, z);
  s.vx = dir * (10 + Math.random() * 6);
  s.vy = -(1 + Math.random() * 2.2);
  s.sp.material.rotation = Math.atan2(s.vy, s.vx) - Math.PI / 2;  // head leads the travel
  s.dur = 1.3 + Math.random() * 0.9;
  s.life = 0;
  s.sp.visible = true;
}

/* ── ripples + pulses, pooled ───────────────────────────────────────── */
const ripples = [];
const ringGeo = new THREE.RingGeometry(0.92, 1.0, 80);
for (let i = 0; i < 6; i++) {
  const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
    color: cur.beam.clone(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  m.visible = false;
  scene.add(m);
  ripples.push({ mesh: m, t: 1, x: 0, z: 0 });
}
const pulses = [];
const pulseGeo = new THREE.SphereGeometry(1, 32, 24);
for (let i = 0; i < 4; i++) {
  const m = new THREE.Mesh(pulseGeo, new THREE.MeshBasicMaterial({
    color: cur.core.clone(), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  }));
  m.position.copy(lookTarget);
  m.visible = false;
  scene.add(m);
  pulses.push({ mesh: m, t: 1 });
}
function spawnRipple(x, z) {
  const r = ripples.find((r) => r.t >= 1) || ripples[0];
  r.t = 0; r.x = x; r.z = z; r.hue = Math.random();   // each ring its own pastel
  r.mesh.position.set(x, 0.015, z);
  r.mesh.visible = true;
}
function spawnPulse() {
  const p = pulses.find((p) => p.t >= 1) || pulses[0];
  p.t = 0; p.mesh.visible = true;
}

/* ── post-processing: the bloom that makes the light glow ───────────── */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.42,  // strength (driven per-frame below)
  0.6,   // radius
  0.6,   // threshold — only the brightest cores bloom, so soft light stays crisp
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ── pointer parallax ───────────────────────────────────────────────── */
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
function onMove(cx, cy) {
  pointer.tx = (cx / window.innerWidth) * 2 - 1;
  pointer.ty = (cy / window.innerHeight) * 2 - 1;
}
window.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY), { passive: true });

/* ── interaction: hold to sing, drag to bend the pitch ───────────────── */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let pulseBoost = 0;     // a brief swell of the heart on each touch
let playGlow = 0;       // eased glow while a voice sings
let playTarget = 0;     // 1 while held, 0 when released
let held = false;       // is the pointer currently pressed
let lastTrail = 0;      // throttle for the ripple trail while dragging
let playNx = 0.5;       // 0..1 across the screen — the note's place, low → high
const nxOf = (cx) => Math.max(0, Math.min(1, cx / window.innerWidth));

function groundXZ(cx, cy) {
  ndc.x = (cx / window.innerWidth) * 2 - 1;
  ndc.y = -(cy / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  let x = 0, z = 0;
  if (raycaster.ray.intersectPlane(groundPlane, hit)) { x = hit.x; z = hit.z; }
  const d = Math.hypot(x, z);              // keep ripples within the room
  if (d > 12) { x *= 12 / d; z *= 12 / d; }
  return { x, z };
}

/* ── React Bits-inspired click sparks, kept vanilla for this static room ─ */
const sparkCanvas = document.getElementById('spark-layer');
const sparkCtx = sparkCanvas?.getContext('2d', { alpha: true });
const sparks = [];
let lastSparkTrail = 0;
function resizeSparkLayer(w = window.innerWidth, h = window.innerHeight) {
  if (!sparkCanvas || !sparkCtx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  sparkCanvas.width = Math.max(1, Math.floor(w * dpr));
  sparkCanvas.height = Math.max(1, Math.floor(h * dpr));
  sparkCanvas.style.width = w + 'px';
  sparkCanvas.style.height = h + 'px';
  sparkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function sparkRgb(kind = 'light') {
  const m = MOODS[moodIdx];
  const base = new THREE.Color(kind === 'core' ? m.core : m.light);
  const beam = new THREE.Color(m.beam);
  base.lerp(beam, Math.random() * 0.45);
  return `${Math.round(base.r * 255)}, ${Math.round(base.g * 255)}, ${Math.round(base.b * 255)}`;
}
function pushSpark(spark) {
  sparks.push(spark);
  if (sparks.length > 260) sparks.splice(0, sparks.length - 260);
}
function spawnSparkBurst(cx, cy, scale = 1) {
  if (reduced || !sparkCtx || visuals.spark <= 0.02) return;
  const count = Math.round((6 + visuals.spark * 20) * scale);
  const radius = 38 + visuals.spark * 64;
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.34;
    const speed = (radius * (0.65 + Math.random() * 0.9)) / 0.62;
    pushSpark({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 0.36 + Math.random() * 0.34 + visuals.spark * 0.18,
      size: 4 + Math.random() * 8 + visuals.spark * 10,
      rgb: sparkRgb(i % 3 === 0 ? 'core' : 'light'),
      spin: (Math.random() - 0.5) * 2,
    });
  }
}
function spawnSparkTrail(cx, cy) {
  if (reduced || !sparkCtx || visuals.trail <= 0.02 || still) return;
  const count = 1 + Math.round(visuals.trail * 3);
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const speed = 24 + Math.random() * 70 * visuals.trail;
    pushSpark({
      x: cx + (Math.random() - 0.5) * 12,
      y: cy + (Math.random() - 0.5) * 12,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 0.42 + Math.random() * 0.24,
      size: 2.5 + visuals.trail * 8,
      rgb: sparkRgb('light'),
      spin: (Math.random() - 0.5) * 3,
    });
  }
}
function drawSparkLayer(dt) {
  if (!sparkCtx || !sparkCanvas) return;
  const w = window.innerWidth, h = window.innerHeight;
  sparkCtx.clearRect(0, 0, w, h);
  if (!sparks.length) return;
  sparkCtx.save();
  sparkCtx.globalCompositeOperation = 'lighter';
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.age += dt;
    if (s.age >= s.life) { sparks.splice(i, 1); continue; }
    const p = s.age / s.life;
    const ease = 1 - Math.pow(1 - p, 2);
    const alpha = (1 - p) * (0.28 + visuals.spark * 0.72);
    s.vx *= Math.pow(0.035, dt);
    s.vy = s.vy * Math.pow(0.045, dt) - 18 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    const tail = s.size * (1 - ease) * (1.4 + visuals.trail * 1.2);
    const angle = Math.atan2(s.vy, s.vx) + s.spin * p;
    sparkCtx.strokeStyle = `rgba(${s.rgb}, ${alpha})`;
    sparkCtx.lineWidth = 1.2 + s.size * 0.09;
    sparkCtx.lineCap = 'round';
    sparkCtx.beginPath();
    sparkCtx.moveTo(s.x - Math.cos(angle) * tail, s.y - Math.sin(angle) * tail);
    sparkCtx.lineTo(s.x + Math.cos(angle) * tail * 0.28, s.y + Math.sin(angle) * tail * 0.28);
    sparkCtx.stroke();
    sparkCtx.fillStyle = `rgba(${s.rgb}, ${alpha * 0.65})`;
    sparkCtx.beginPath();
    sparkCtx.arc(s.x, s.y, Math.max(0.7, s.size * 0.12 * (1 - p)), 0, Math.PI * 2);
    sparkCtx.fill();
  }
  sparkCtx.restore();
}
resizeSparkLayer();

canvas.addEventListener('pointerdown', (e) => {
  if (held) return;          // one voice at a time — ignore extra fingers
  ensureAudio();
  // the first touch is a real user gesture — let the room find its voice,
  // unless the visitor has already chosen quiet for themselves.
  if (!userSetSound && !soundOn) setSound(true);
  body.classList.add('touched');
  if (!hintGone) hideHint();
  const g = groundXZ(e.clientX, e.clientY);
  spawnRipple(g.x, g.z);
  spawnSparkBurst(e.clientX, e.clientY);
  spawnPulse();
  pulseBoost = 1;
  held = true;
  playTarget = 1;
  playNx = nxOf(e.clientX);
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  startVoice(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e) => {
  if (!held) return;
  playNx = nxOf(e.clientX);
  bendVoice(e.clientX, e.clientY);          // dragging bends the pitch
  const now = performance.now();
  if (now - lastSparkTrail > 42) {
    lastSparkTrail = now;
    spawnSparkTrail(e.clientX, e.clientY);
  }
  if (now - lastTrail > 110) {              // a sparse trail of ripples
    lastTrail = now;
    const g = groundXZ(e.clientX, e.clientY);
    spawnRipple(g.x, g.z);
  }
});
function release() {
  if (!held) return;
  held = false;
  playTarget = 0;
  endVoice();
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
window.addEventListener('blur', release);

/* ── sound: a generated ambient pad + a playable stylophone voice ───── */
let audio = null, soundOn = false, userSetSound = false;
function ensureAudio() {
  if (audio) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;        // silent until sound is switched on
  master.connect(ctx.destination);

  // a long, soft reverb tail from decaying noise
  const verb = ctx.createConvolver();
  const len = ctx.sampleRate * 3.2;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  verb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = settings.reverb;
  verb.connect(wet); wet.connect(master);

  // the ambient drone: a few detuned voices under a slow filter
  const drone = ctx.createGain(); drone.gain.value = 0.05;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 540; lp.Q.value = 0.6;
  drone.connect(lp); lp.connect(master); lp.connect(verb);
  [55, 82.41, 110, 164.81].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i % 2 ? 'triangle' : 'sine';
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 5;
    const g = ctx.createGain(); g.gain.value = i === 0 ? 0.5 : 0.22;
    o.connect(g); g.connect(drone); o.start();
  });
  // a slow swell on the filter so the pad never sits still
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
  const lfoG = ctx.createGain(); lfoG.gain.value = 180;
  lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();

  audio = { ctx, master, verb, wet };
}
/* ── tone settings, driven by the hideable panel (defaults match the
   slider values in the markup) ──────────────────────────────────────── */
const mapRelease    = (s) => 0.09 * Math.pow(24, s);   // linger: 0.09s … ~2.2s
const mapGlide      = (s) => 0.01 + s * 0.24;          // portamento time
const mapBrightness = (s) => 0.5 + s * 1.3;            // lowpass multiplier
const mapReverb     = (s) => s * 0.92;                 // reverb wet level
const settings = {
  release:    mapRelease(0.25),
  glide:      mapGlide(0.25),
  brightness: mapBrightness(0.4),
  reverb:     mapReverb(0.5),
};
let lastCy = window.innerHeight * 0.5;   // remembered so tone tweaks apply live

/* a glide-able ladder — A-minor pentatonic across two octaves, in tune with
   the drone. position maps continuously onto it; the voice slides between
   rungs as you drag, so a held drag reads as a smooth pitch bend. */
const LADDER = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
function freqFromX(cx) {
  const nx = Math.max(0, Math.min(1, cx / window.innerWidth));
  const fi = nx * (LADDER.length - 1);
  const i = Math.floor(fi), f = fi - i;
  const a = LADDER[i], b = LADDER[Math.min(LADDER.length - 1, i + 1)];
  return a * Math.pow(b / a, f);            // log-interpolate → a smooth bend
}
function cutoffFromY(cy) {
  const ny = Math.max(0, Math.min(1, cy / window.innerHeight));
  return 680 * Math.pow(4.2, 1 - ny) * settings.brightness;  // drag up → brighter
}

let voice = null;     // the single held stylophone voice
function startVoice(cx, cy) {
  if (!audio || !soundOn) return;
  lastCy = cy;
  const { ctx, master, verb } = audio;
  const now = ctx.currentTime;
  const freq = freqFromX(cx);
  const saw = ctx.createOscillator(); saw.type = 'sawtooth';
  const sqr = ctx.createOscillator(); sqr.type = 'square'; sqr.detune.value = -3;
  const sub = ctx.createOscillator(); sub.type = 'sine';
  saw.frequency.value = freq; sqr.frequency.value = freq; sub.frequency.value = freq / 2;
  // a gentle vibrato — the stylophone's wavering reed
  const vib = ctx.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.6;
  const vibG = ctx.createGain(); vibG.gain.value = 4.5;   // ± cents
  vib.connect(vibG); vibG.connect(saw.detune); vibG.connect(sqr.detune);
  // a lowpass keeps the reed warm rather than harsh
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
  lp.frequency.value = cutoffFromY(cy);
  const sawG = ctx.createGain(); sawG.gain.value = 0.5;
  const sqrG = ctx.createGain(); sqrG.gain.value = 0.16;
  const subG = ctx.createGain(); subG.gain.value = 0.4;
  saw.connect(sawG); sawG.connect(lp);
  sqr.connect(sqrG); sqrG.connect(lp);
  const env = ctx.createGain(); env.gain.value = 0.0001;
  lp.connect(env);
  sub.connect(subG); subG.connect(env);     // sub bypasses the filter, for body
  env.connect(master); env.connect(verb);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(0.16, now + 0.04);   // soft attack
  saw.start(now); sqr.start(now); sub.start(now); vib.start(now);
  voice = { saw, sqr, sub, vib, lp, env };
}
function bendVoice(cx, cy) {
  if (!voice || !audio) return;
  lastCy = cy;
  const now = audio.ctx.currentTime;
  const freq = freqFromX(cx);
  const glide = settings.glide;               // portamento → the bend itself
  voice.saw.frequency.setTargetAtTime(freq, now, glide);
  voice.sqr.frequency.setTargetAtTime(freq, now, glide);
  voice.sub.frequency.setTargetAtTime(freq / 2, now, glide);
  voice.lp.frequency.setTargetAtTime(cutoffFromY(cy), now, 0.05);
}
function endVoice() {
  if (!voice || !audio) return;
  const now = audio.ctx.currentTime;
  const v = voice; voice = null;
  v.env.gain.cancelScheduledValues(now);
  v.env.gain.setValueAtTime(Math.max(0.0001, v.env.gain.value), now);
  v.env.gain.setTargetAtTime(0.0001, now, settings.release);   // the linger
  const stop = now + settings.release * 6 + 0.25;
  [v.saw, v.sqr, v.sub, v.vib].forEach((o) => o.stop(stop));
}

/* ── controls ───────────────────────────────────────────────────────── */
const soundBtn = document.getElementById('sound');
const soundIcon = document.getElementById('sound-icon');
function setSound(on) {
  soundOn = on;
  soundBtn.setAttribute('aria-pressed', String(on));
  soundIcon.querySelectorAll('.wave').forEach((w) => { w.style.opacity = on ? '1' : '0.2'; });
  if (on) { ensureAudio(); }
  if (audio) {
    const now = audio.ctx.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setTargetAtTime(on ? 0.85 : 0.0, now, 0.8);
  }
}
soundBtn.addEventListener('click', () => { userSetSound = true; setSound(!soundOn); });
soundIcon.querySelectorAll('.wave').forEach((w) => { w.style.opacity = '0.2'; w.style.transition = 'opacity .3s ease'; });

const moodDot = document.getElementById('mood-dot');
const moodName = document.getElementById('mood-name');
const moodStrip = document.getElementById('mood-strip');
let moodNameTimer = null;
let lightKickTimer = null;
function updateMoodSwatches() {
  moodStrip.querySelectorAll('.mood-swatch').forEach((button, i) => {
    button.setAttribute('aria-pressed', String(i === moodIdx));
  });
}
function buildMoodStrip() {
  MOODS.forEach((m, i) => {
    const button = document.createElement('button');
    button.className = 'mood-swatch';
    button.type = 'button';
    button.title = m.name;
    button.setAttribute('aria-label', m.name);
    button.style.setProperty('--mood-light', moodHex(m.light));
    button.style.setProperty('--mood-core', moodHex(m.core));
    button.style.setProperty('--mood-ground', moodHex(m.ground));
    button.addEventListener('click', () => setMood(i, true));
    moodStrip.appendChild(button);
  });
  updateMoodSwatches();
}
function applyMood(showName, persist = true) {
  const m = MOODS[moodIdx];
  moodDot.style.setProperty('--mood', '#' + new THREE.Color(m.light).getHexString());
  updateMoodSwatches();
  updatePaperShader(true);
  if (showName) {
    moodName.textContent = m.name;
    moodName.classList.add('show');
    clearTimeout(moodNameTimer);
    moodNameTimer = setTimeout(() => moodName.classList.remove('show'), 1600);
  }
  if (persist) saveVisualState();
}
function setMood(index, showName) {
  moodIdx = ((index % MOODS.length) + MOODS.length) % MOODS.length;
  applyMood(showName);
}
function kickLight() {
  body.classList.add('touched', 'light-kick');
  clearTimeout(lightKickTimer);
  lightKickTimer = setTimeout(() => body.classList.remove('light-kick'), 760);
}
function pulseLight() {
  kickLight();
  spawnSparkBurst(window.innerWidth * 0.5, window.innerHeight * 0.45, 1.4);
  spawnPulse();
  pulseBoost = Math.max(pulseBoost, 1);
  if (stars.length) launchStar();
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.4 + Math.random() * 5.4;
    spawnRipple(Math.cos(a) * r, Math.sin(a) * r);
  }
}
function setVisual(key, value, persist = true) {
  visuals[key] = clamp01(value);
  applyPaperStyle();
  applySparkStyle();
  updatePaperShader(true);
  syncPaperShaderSpeed();
  if (persist) saveVisualState();
}
function syncVisualControls() {
  Object.entries({
    wash: 'v-wash',
    warp: 'v-warp',
    grain: 'v-grain',
    drift: 'v-drift',
    zoom: 'v-zoom',
    spark: 'v-spark',
    trail: 'v-trail',
  }).forEach(([key, id]) => {
    const input = document.getElementById(id);
    if (input) input.value = visuals[key].toFixed(2);
  });
}
function bindVisual(id, key) {
  document.getElementById(id).addEventListener('input', (e) =>
    setVisual(key, parseFloat(e.target.value)));
}
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
function shuffleLight() {
  moodIdx = Math.floor(Math.random() * MOODS.length);
  visuals.wash = randomBetween(0.34, 0.95);
  visuals.warp = randomBetween(0.18, 1);
  visuals.grain = randomBetween(0.06, 0.78);
  visuals.drift = randomBetween(0.12, 0.92);
  visuals.zoom = randomBetween(0.12, 0.92);
  visuals.spark = randomBetween(0.2, 1);
  visuals.trail = randomBetween(0.06, 0.86);
  syncVisualControls();
  applyPaperStyle();
  applySparkStyle();
  applyMood(true, false);
  syncPaperShaderSpeed();
  saveVisualState();
  pulseLight();
}
function resetLight() {
  Object.assign(visuals, DEFAULT_VISUALS);
  syncVisualControls();
  applyPaperStyle();
  applySparkStyle();
  updatePaperShader(true);
  syncPaperShaderSpeed();
  saveVisualState();
  pulseLight();
}
document.getElementById('mood').addEventListener('click', () => {
  setMood(moodIdx + 1, true);
});
buildMoodStrip();
syncVisualControls();
applyMood(false, false);

const stillBtn = document.getElementById('still');
stillBtn.addEventListener('click', () => {
  still = !still;
  stillBtn.setAttribute('aria-pressed', String(still));
  syncPaperShaderSpeed();
});

const fsBtn = document.getElementById('fs');
fsBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});

/* ── the tone panel ──────────────────────────────────────────────────── */
const tuneBtn = document.getElementById('tune');
const lightBtn = document.getElementById('light');
const tonesPanel = document.getElementById('tones');
const lightPanel = document.getElementById('light-panel');
function setPanel(openPanel, open) {
  const toneOpen = openPanel === 'tones' && open;
  const lightOpen = openPanel === 'light' && open;
  body.classList.toggle('tones-open', toneOpen);
  body.classList.toggle('light-open', lightOpen);
  tuneBtn.setAttribute('aria-pressed', String(toneOpen));
  lightBtn.setAttribute('aria-pressed', String(lightOpen));
  tonesPanel.setAttribute('aria-hidden', String(!toneOpen));
  lightPanel.setAttribute('aria-hidden', String(!lightOpen));
}
tuneBtn.addEventListener('click', () => {
  const open = !body.classList.contains('tones-open');
  setPanel('tones', open);
});
lightBtn.addEventListener('click', () => {
  const open = !body.classList.contains('light-open');
  setPanel('light', open);
});
const bindTone = (id, apply) =>
  document.getElementById(id).addEventListener('input', (e) => apply(parseFloat(e.target.value)));
bindTone('t-linger', (s) => { settings.release = mapRelease(s); });
bindTone('t-glide',  (s) => { settings.glide = mapGlide(s); });
bindTone('t-tone',   (s) => {
  settings.brightness = mapBrightness(s);
  if (voice && audio) voice.lp.frequency.setTargetAtTime(cutoffFromY(lastCy), audio.ctx.currentTime, 0.05);
});
bindTone('t-reverb', (s) => {
  settings.reverb = mapReverb(s);
  if (audio) audio.wet.gain.setTargetAtTime(settings.reverb, audio.ctx.currentTime, 0.1);
});
bindVisual('v-wash', 'wash');
bindVisual('v-warp', 'warp');
bindVisual('v-grain', 'grain');
bindVisual('v-drift', 'drift');
bindVisual('v-zoom', 'zoom');
bindVisual('v-spark', 'spark');
bindVisual('v-trail', 'trail');
document.getElementById('v-pulse').addEventListener('click', pulseLight);
document.getElementById('v-shuffle').addEventListener('click', shuffleLight);
document.getElementById('v-reset').addEventListener('click', resetLight);

/* the hint fades on its own after a while if untouched */
let hintGone = false;
function hideHint() { hintGone = true; body.classList.add('touched'); }
setTimeout(() => { if (!hintGone) hideHint(); }, 9000);

/* let the dock recede when the room is left alone */
const dock = document.getElementById('dock');
const homeBtn = document.querySelector('.home');
let idleTimer = null;
function wake() {
  dock.classList.remove('dim'); homeBtn.classList.remove('dim');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (body.classList.contains('tones-open') || body.classList.contains('light-open')) return;
    dock.classList.add('dim'); homeBtn.classList.add('dim');
  }, 4500);
}
['pointermove', 'pointerdown', 'keydown'].forEach((ev) =>
  window.addEventListener(ev, wake, { passive: true }));
wake();

/* ── resize ─────────────────────────────────────────────────────────── */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  resizeSparkLayer(w, h);
  const sc = moteScale();
  motes.material.uniforms.uScale.value = sc;
  bokeh.material.uniforms.uScale.value = sc;
  if (reflector) {
    const r = renderer.getPixelRatio();
    reflector.getRenderTarget().setSize(
      Math.max(256, Math.floor(w * r * 0.5)),
      Math.max(256, Math.floor(h * r * 0.5)),
    );
  }
  updatePaperShader(true);
}
window.addEventListener('resize', resize);

/* ── the loop ───────────────────────────────────────────────────────── */
const clock = new THREE.Clock();
let visible = true;
document.addEventListener('visibilitychange', () => {
  visible = !document.hidden;
  if (document.hidden) release();          // never leave a voice ringing
  if (visible) clock.getDelta();           // swallow the gap so nothing jumps
});

const tmpColor = new THREE.Color();
const iris = new THREE.Color();   // a slow pastel-rainbow tint, shared by halo + motes
const playColor = new THREE.Color();   // the note's colour: low → red, high → blue
function render() {
  requestAnimationFrame(render);
  if (!visible) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // ease working colours toward the active mood
  const m = MOODS[moodIdx];
  updatePaperShader();
  const k = 1 - Math.pow(0.5, dt / 0.9);
  cur.fog.lerp(tmpColor.set(m.fog), k);
  cur.light.lerp(tmpColor.set(m.light), k);
  cur.core.lerp(tmpColor.set(m.core), k);
  cur.mote.lerp(tmpColor.set(m.mote), k);
  cur.beam.lerp(tmpColor.set(m.beam), k);
  cur.ground.lerp(tmpColor.set(m.ground), k);

  // a pastel rainbow that eases slowly round the wheel
  const hueShift = (t * 0.018) % 1;
  iris.setHSL((t * 0.03) % 1, 0.5, 0.78);
  // the played note's colour — low notes red, gliding up to blue
  playColor.setHSL(playNx * 0.66, 0.7, 0.58);
  const tint = playGlow * 0.85;   // only while a voice is singing

  scene.background.copy(cur.fog);
  scene.fog.color.copy(cur.fog);
  floorMat.color.copy(cur.ground);
  coreMat.color.copy(cur.core).lerp(playColor, tint);
  shellMat.emissive.copy(cur.core).lerp(playColor, tint * 0.6);
  wire.material.color.copy(cur.core).lerp(iris, 0.32);              // iridescent edge
  halo.material.color.copy(cur.core).lerp(iris, 0.5).lerp(playColor, tint * 0.7);
  coreLight.color.copy(cur.light).lerp(playColor, tint * 0.6);
  beamMat.uniforms.uColor.value.copy(cur.beam);
  auroraMat.uniforms.uTime.value = t;
  auroraMat.uniforms.uMood.value.copy(cur.light).lerp(playColor, tint * 0.35);  // sky answers the note

  // the heart breathes
  const breath = 0.5 + 0.5 * Math.sin(t * 0.55);
  const boost = pulseBoost;
  pulseBoost = Math.max(0, pulseBoost - dt * 1.6);
  playGlow += (playTarget - playGlow) * Math.min(1, dt * 3.5);   // the room sings while held
  const scl = 1 + breath * 0.05 + boost * 0.12 + playGlow * 0.05;
  core.scale.setScalar(scl);
  shell.scale.setScalar(1 + breath * 0.03 + playGlow * 0.03);
  coreLight.intensity = 5.5 + breath * 2 + boost * 9 + playGlow * 4;
  shellMat.emissiveIntensity = 0.2 + breath * 0.14 + boost * 0.35 + playGlow * 0.22;
  halo.material.opacity = 0.055 + breath * 0.03 + boost * 0.13 + playGlow * 0.07;
  bloom.strength = 0.36 + breath * 0.07 + boost * 0.26 + playGlow * 0.1;
  auroraMat.uniforms.uIntensity.value = 0.7 + breath * 0.16 + playGlow * 0.12;

  if (!still && !reduced) {
    heart.rotation.y += dt * 0.12;
    heart.rotation.x = Math.sin(t * 0.18) * 0.12;
    wire.rotation.y -= dt * 0.05;
  }

  // motes drift upward and wander, wrapping back to the floor
  [motes, bokeh].forEach((sys, idx) => {
    const u = sys.material.uniforms;
    u.uTime.value = t;
    u.uHueShift.value = hueShift;
    u.uMood.value.copy(cur.mote);
    const p = sys.geometry.attributes.position;
    const a = p.array, seed = sys.userData.seed, H = sys.userData.height;
    const rise = (idx === 0 ? 0.22 : 0.09) * (still ? 0.3 : 1);
    for (let i = 0; i < seed.length; i++) {
      const s = seed[i];
      a[i * 3 + 1] += dt * rise;
      a[i * 3]     += Math.sin(t * 0.3 + s) * dt * 0.06;
      a[i * 3 + 2] += Math.cos(t * 0.27 + s * 1.3) * dt * 0.06;
      if (a[i * 3 + 1] > H) { a[i * 3 + 1] = 0; }
    }
    p.needsUpdate = true;
    sys.rotation.y += dt * (idx === 0 ? 0.012 : 0.005);
  });

  // ripples expand and fade
  ripples.forEach((r) => {
    if (r.t >= 1) { if (r.mesh.visible) r.mesh.visible = false; return; }
    r.t = Math.min(1, r.t + dt / 2.6);
    const e = r.t;
    const s = 0.4 + e * 6.5;
    r.mesh.scale.setScalar(s);
    // a soft pastel ring, drifting hue, leaning toward the mood's beam
    tmpColor.setHSL(((r.hue || 0) + t * 0.04) % 1, 0.5, 0.72);
    r.mesh.material.color.copy(cur.beam).lerp(tmpColor, 0.6);
    r.mesh.material.opacity = (1 - e) * 0.5 * (1 - e * 0.3);
  });
  // pulses bloom outward from the heart
  pulses.forEach((p) => {
    if (p.t >= 1) { if (p.mesh.visible) p.mesh.visible = false; return; }
    p.t = Math.min(1, p.t + dt / 1.8);
    const e = p.t;
    p.mesh.scale.setScalar(0.6 + e * 4.5);
    p.mesh.material.color.copy(cur.core);
    p.mesh.material.opacity = (1 - e) * 0.35;
  });

  // shooting stars cross the far sky now and then
  if (stars.length) {
    nextStar -= dt;
    if (nextStar <= 0) { launchStar(); nextStar = 5 + Math.random() * 9; }
    stars.forEach((s) => {
      if (s.life >= s.dur) return;
      s.life += dt;
      const e = s.life / s.dur;
      s.sp.position.x += s.vx * dt;
      s.sp.position.y += s.vy * dt;
      // fade in over the first sixth, out over the rest
      s.sp.material.opacity = Math.min(1, e / 0.16) * (1 - e) * 0.9;
      if (e >= 1) s.sp.visible = false;
    });
  }

  // camera: gentle auto-drift + pointer parallax, eased
  pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 2.4);
  pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 2.4);
  const driftA = (still || reduced) ? 0 : Math.sin(t * 0.06) * 0.5;
  const px = pointer.x * 1.5 + Math.sin(driftA) * 0.7;
  const py = -pointer.y * 0.7;
  camera.position.x += (camHome.x + px - camera.position.x) * Math.min(1, dt * 1.6);
  camera.position.y += (camHome.y + py - camera.position.y) * Math.min(1, dt * 1.6);
  camera.position.z = camHome.z;
  camera.lookAt(lookTarget);

  composer.render();
  drawSparkLayer(dt);

  if (!body.classList.contains('ready')) body.classList.add('ready');
}
render();

// start muted; the room stays quiet until the first touch or the toggle
setSound(false);

return () => {};
}


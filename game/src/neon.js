// NEON.JS — color, light and texture language for Puerto Sol.
// Every surface is painted in a browser canvas: sun-bleached stucco, hot windows,
// hand-lettered signs, palm fronds. Nothing is loaded from disk or the network.
import * as THREE from 'three';

export const PALETTE = {
  skyTop: 0x121c46,
  skyMid: 0xff6b5b,
  skyHorizon: 0xffd19a,
  sun: 0xfff0c2,
  haze: 0xf3a184,
  water: 0x0a5b74,
  waterDeep: 0x063849,
  sand: 0xe9c48d,
  sandLight: 0xf3d7a6,
  asphalt: 0x252933,
  sidewalk: 0xd6c1a3,
  cream: 0xf4e3c2,
  coral: 0xff6f52,
  hotPink: 0xff3f8f,
  cyan: 0x47f5e2,
  gold: 0xffcf68,
  ink: 0x18192b,
  leaf: 0x2c7561,
  leafLight: 0x67a474,
};

export const NEON = [PALETTE.hotPink, PALETTE.cyan, PALETTE.gold, PALETTE.coral, 0xb693ff, 0x7ef29b];

/** Small deterministic PRNG used by every generator in the city. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Paint a canvas and return it as an sRGB texture. */
export function textureFromCanvas(draw, width = 256, height = 256, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = options.wrapS ?? THREE.ClampToEdgeWrapping;
  texture.wrapT = options.wrapT ?? THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Clone a repeat-wrapped texture without duplicating its canvas. */
export function repeated(texture, x, y) {
  const clone = texture.clone();
  clone.wrapS = THREE.RepeatWrapping;
  clone.wrapT = THREE.RepeatWrapping;
  clone.repeat.set(Math.max(1, x), Math.max(1, y));
  clone.needsUpdate = true;
  return clone;
}

export function flatMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? 0.82, metalness: options.metalness ?? 0.04, ...options });
}

export function glowMaterial(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity });
}

export function neonMaterial(color, intensity = 1) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });
}

export function glassMaterial(color = 0x162e4b) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.16,
    metalness: 0.7,
    emissive: 0x071425,
    emissiveIntensity: 0.4,
  });
}

/** Five facade families. The first canvas is the wall, the second is pure window light. */
export const FACADE_STYLES = [
  { wall: '#e5c8a2', trim: '#b77c62', glass: '#18344f', lit: ['#ffd88c', '#ffba68', '#7fd6cf'] },
  { wall: '#c96f6b', trim: '#7f434b', glass: '#1a2e49', lit: ['#ffd18b', '#ff9e7d', '#80e0d3'] },
  { wall: '#8ab4ad', trim: '#4f7778', glass: '#163143', lit: ['#ffe0a2', '#ffb778', '#7fe6e0'] },
  { wall: '#d9d2bd', trim: '#8c887a', glass: '#1b2d43', lit: ['#ffd892', '#ffc278', '#b9f3e6'] },
  { wall: '#b98ca8', trim: '#74566c', glass: '#1d2845', lit: ['#ffcf8b', '#ff9eca', '#8ce6d8'] },
];

/**
 * A facade texture pair. The diffuse map has frames, grime and a few lit rooms;
 * the emissive map contains only those rooms so the whole wall never glows.
 */
export function makeWindowTextures(styleIndex, seed = 7) {
  const style = FACADE_STYLES[styleIndex % FACADE_STYLES.length];
  const rand = mulberry32(seed * 97 + styleIndex * 31 + 3);
  const cols = 4;
  const rows = 6;
  const lit = Array.from({ length: cols * rows }, () => rand() > 0.6);
  const warm = lit.map(() => style.lit[Math.floor(rand() * style.lit.length)]);

  const map = textureFromCanvas((ctx, w, h) => {
    ctx.fillStyle = style.wall;
    ctx.fillRect(0, 0, w, h);
    // sun-bleached horizontal banding
    ctx.globalAlpha = 0.16;
    for (let y = 0; y < h; y += 8) {
      ctx.fillStyle = y % 16 ? '#ffffff' : style.trim;
      ctx.fillRect(0, y, w, 2);
    }
    ctx.globalAlpha = 1;
    const cellW = w / cols;
    const cellH = h / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cellW + cellW * 0.19;
        const y = row * cellH + cellH * 0.18;
        const ww = cellW * 0.62;
        const hh = cellH * 0.55;
        ctx.fillStyle = style.trim;
        ctx.fillRect(x - 3, y - 3, ww + 6, hh + 6);
        const grad = ctx.createLinearGradient(x, y, x + ww, y + hh);
        const isLit = lit[row * cols + col];
        grad.addColorStop(0, isLit ? warm[row * cols + col] : style.glass);
        grad.addColorStop(0.48, isLit ? '#ffe9b0' : '#48728a');
        grad.addColorStop(1, isLit ? '#ffb56b' : '#0e1d31');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, ww, hh);
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillRect(x + ww * 0.12, y + hh * 0.08, ww * 0.12, hh * 0.8);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + ww * 0.64, y, 2, hh);
      }
    }
    ctx.fillStyle = 'rgba(44,32,46,0.16)';
    for (let i = 0; i < 26; i++) ctx.fillRect(rand() * w, h - rand() * 18, 2 + rand() * 10, 1);
    ctx.fillStyle = style.trim;
    ctx.fillRect(0, 0, 7, h);
    ctx.fillRect(w - 7, 0, 7, h);
    ctx.fillRect(0, 0, w, 6);
  }, 192, 288, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });

  const emissive = textureFromCanvas((ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    const cellW = w / cols;
    const cellH = h / rows;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (!lit[row * cols + col]) continue;
        ctx.fillStyle = warm[row * cols + col];
        ctx.fillRect(col * cellW + cellW * 0.19, row * cellH + cellH * 0.18, cellW * 0.62, cellH * 0.55);
      }
    }
  }, 192, 288, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  return { map, emissive };
}

/** Grainy asphalt with faded repairs and a little reflected sunset. */
export function makeAsphaltTexture(seed = 1) {
  const rand = mulberry32(seed + 55);
  return textureFromCanvas((ctx, w, h) => {
    ctx.fillStyle = '#292d37';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      const g = 38 + Math.floor(rand() * 42);
      ctx.fillStyle = `rgba(${g},${g + 2},${g + 8},${0.25 + rand() * 0.45})`;
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3);
    }
    ctx.strokeStyle = 'rgba(12,14,22,0.4)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(rand() * w, 0);
      for (let y = 0; y < h; y += 32) ctx.lineTo(rand() * w, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,140,100,0.07)';
    ctx.fillRect(0, 0, w, h);
  }, 256, 256, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
}

/** Warm paving stones. */
export function makePavingTexture(seed = 3) {
  const rand = mulberry32(seed);
  return textureFromCanvas((ctx, w, h) => {
    ctx.fillStyle = '#cfb99a';
    ctx.fillRect(0, 0, w, h);
    const step = 32;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const tint = 205 + Math.floor(rand() * 25);
        ctx.fillStyle = `rgb(${tint},${tint - 24},${tint - 52})`;
        ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
      }
    }
    ctx.strokeStyle = 'rgba(130,105,84,0.42)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,190,140,0.1)';
    ctx.fillRect(0, 0, w, h);
  }, 256, 256, { wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
}

/** A hand-painted neon board, glow baked into the canvas. */
export function makeSignTexture(text, options = {}) {
  const bg = options.bg ?? '#15182b';
  const fg = options.fg ?? '#ff77b4';
  const accent = options.accent ?? '#55f5e6';
  const sub = options.sub ?? '';
  const width = options.width ?? 512;
  const height = options.height ?? 160;
  return textureFromCanvas((ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(4,5,12,0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.shadowColor = fg;
    ctx.shadowBlur = 22;
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.min(70, Math.floor((w * 1.8) / Math.max(4, text.length)));
    ctx.font = `900 ${size}px 'Arial Narrow', Impact, sans-serif`;
    ctx.fillText(text, w / 2, h * (sub ? 0.43 : 0.5));
    if (sub) {
      ctx.shadowBlur = 12;
      ctx.fillStyle = accent;
      ctx.font = '700 22px Arial, sans-serif';
      ctx.fillText(sub, w / 2, h * 0.76);
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 5; i++) ctx.fillRect(0, (i * 37) % h, w, 2);
  }, width, height);
}

/** Big sunlit poster for the side of a hotel or a roadside billboard. */
export function makeBillboardTexture(title, sub, colors = ['#ff7d61', '#4b2a67', '#ffd477']) {
  return textureFromCanvas((ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.55, colors[1]);
    grad.addColorStop(1, colors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(15,16,38,0.28)';
    for (let i = 0; i < 8; i++) ctx.fillRect(0, 300 + i * 10, w, 4);
    ctx.fillStyle = '#101226';
    ctx.textAlign = 'left';
    ctx.font = '900 58px Impact, sans-serif';
    ctx.fillText(title, 30, 90);
    ctx.fillStyle = '#fff1cf';
    ctx.font = '700 24px Arial, sans-serif';
    ctx.fillText(sub.toUpperCase(), 32, 132);
    ctx.strokeStyle = 'rgba(255,240,200,0.8)';
    ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    // painted sun and wave motif
    ctx.fillStyle = '#ffe6a8';
    ctx.beginPath();
    ctx.arc(w - 94, h - 86, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2ad9d2';
    ctx.lineWidth = 6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w - 94, h - 86 + i * 16, 64 + i * 16, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }, 512, 256);
}

/** Radial glow sprite used by streetlights, signs and the setting sun. */
export function makeGlowTexture(colorA = '#ffd89a', colorB = 'rgba(255,120,70,0)') {
  return textureFromCanvas((ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, colorA);
    gradient.addColorStop(0.22, colorA);
    gradient.addColorStop(1, colorB);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }, 128, 128);
}

/** A soft cutout for palm fronds. */
export function makeFrondTexture() {
  return textureFromCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h);
    ctx.strokeStyle = '#245e4e';
    ctx.fillStyle = '#3b876d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(0, -h * 0.62, 0, -h * 0.96);
    ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const t = i / 16;
      const y = -h * (0.08 + t * 0.82);
      const span = (1 - t * 0.65) * w * 0.42;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(-span * 0.6, y - 9, -span, y - 4);
      ctx.quadraticCurveTo(-span * 0.5, y + 5, 0, y + 3);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(span * 0.6, y - 9, span, y - 4);
      ctx.quadraticCurveTo(span * 0.5, y + 5, 0, y + 3);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,220,130,0.16)';
    ctx.fillRect(-w / 2, -h, w, h);
  }, 128, 256);
}

/** Thin light shaft texture for objective beacons. */
export function makeBeamTexture() {
  return textureFromCanvas((ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,220,140,0)');
    grad.addColorStop(0.25, 'rgba(255,215,120,0.55)');
    grad.addColorStop(1, 'rgba(255,155,90,0.03)');
    ctx.fillStyle = grad;
    ctx.fillRect(w * 0.3, 0, w * 0.4, h);
  }, 64, 256);
}

/** One shell material family for the city's cheaper hard surfaces. */
export function surfaceMemo() {
  const cache = new Map();
  return (key, make) => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  };
}


/**
 * Lightweight canvas line chart for the science panel. Supports log axes,
 * time-aware tick labels (seconds → years) and cheap redraws (~0.2 ms).
 */
import { h } from './dom.js';
import { fmtDuration, fmtYears, sci } from '../core/units.js';
import { clamp } from '../core/math.js';

const PAD = { l: 44, r: 10, t: 22, b: 20 };

export class Chart {
  constructor({ title, unit = '', color = '#7cc7ff', yLog = true, xMode = 'time', minDecades = 1 }) {
    this.title = title;
    this.unit = unit;
    this.color = color;
    this.yLog = yLog;
    this.xMode = xMode;
    this.minDecades = minDecades;
    this.canvas = h('canvas', { class: 'chart-canvas' });
    this.el = h('div', { class: 'chart' }, this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.lastDraw = 0;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.el.getBoundingClientRect();
    const w = Math.max(rect.width, 120) || 260;
    const hgt = Math.max(rect.height, 60) || 108;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(hgt * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hgt * dpr);
    }
    this.dpr = dpr;
    this.w = w;
    this.h = hgt;
  }

  setXMode(mode) { this.xMode = mode; }

  update(xs, ys, marker = null) {
    this.resize();
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = 'left';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(220,228,245,0.85)';
    ctx.fillText(this.title, 6, 13);
    if (this.unit) {
      ctx.fillStyle = 'rgba(160,172,200,0.7)';
      ctx.textAlign = 'right';
      ctx.fillText(this.unit, w - 6, 13);
      ctx.textAlign = 'left';
    }
    const pts = [];
    for (let i = 0; i < xs.length; i++) {
      const y = ys[i];
      if (!(isFinite(y)) || (this.yLog && y <= 0)) continue;
      pts.push([xs[i], y]);
    }
    if (pts.length < 2) {
      ctx.fillStyle = 'rgba(160,172,200,0.45)';
      ctx.fillText('collecting data…', PAD.l, h / 2 + 4);
      return;
    }
    // X mapping: log for explosion time (positive), linear for stellar age
    const xLog = this.xMode === 'time';
    const fx = (x) => (xLog ? Math.log10(Math.max(x, 1e-2)) : x);
    let xmin = Infinity; let xmax = -Infinity; let ymin = Infinity; let ymax = -Infinity;
    for (const [x, y] of pts) {
      const X = fx(x); const Y = this.yLog ? Math.log10(y) : y;
      if (X < xmin) xmin = X; if (X > xmax) xmax = X; if (Y < ymin) ymin = Y; if (Y > ymax) ymax = Y;
    }
    if (xmax - xmin < 1e-9) xmax = xmin + 1;
    if (ymax - ymin < (this.yLog ? this.minDecades : 1e-9)) { const c = (ymax + ymin) / 2; ymin = c - this.minDecades / 2; ymax = c + this.minDecades / 2; }
    const iw = w - PAD.l - PAD.r; const ih = h - PAD.t - PAD.b;
    const px = (X) => PAD.l + ((X - xmin) / (xmax - xmin)) * iw;
    const py = (Y) => PAD.t + ih - ((Y - ymin) / (ymax - ymin)) * ih;

    // grid + y ticks
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.fillStyle = 'rgba(160,172,200,0.75)';
    ctx.lineWidth = 1;
    const yTicks = this.yLog ? logTicks(ymin, ymax) : linTicks(ymin, ymax);
    for (const t of yTicks) {
      const y = py(t);
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(w - PAD.r, y); ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(this.yLog ? `10${sup(Math.round(t))}` : sci(t, 1), PAD.l - 4, y + 3);
    }
    // x ticks
    ctx.textAlign = 'center';
    const xTicks = xLog ? logTicks(xmin, xmax, 6) : linTicks(xmin, xmax, 4);
    for (const t of xTicks) {
      const x = px(t);
      ctx.beginPath(); ctx.moveTo(x, PAD.t); ctx.lineTo(x, h - PAD.b); ctx.stroke();
      const label = xLog ? fmtDuration(Math.pow(10, t), 0) : fmtYears(t, 1);
      ctx.fillText(label, clamp(x, PAD.l + 14, w - 18), h - 6);
    }
    // line
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let first = true;
    for (const [x, y] of pts) {
      const X = px(fx(x)); const Y = py(this.yLog ? Math.log10(y) : y);
      if (first) { ctx.moveTo(X, Y); first = false; } else ctx.lineTo(X, Y);
    }
    ctx.stroke();
    // current value dot
    const [lx, ly] = pts[pts.length - 1];
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(px(fx(lx)), py(this.yLog ? Math.log10(ly) : ly), 2.5, 0, Math.PI * 2); ctx.fill();
    if (marker != null) {
      const X = px(fx(marker));
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(X, PAD.t); ctx.lineTo(X, h - PAD.b); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

const SUPS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
function sup(n) {
  const s = String(Math.abs(n)).split('').map((c) => SUPS[+c]).join('');
  return (n < 0 ? '⁻' : '') + s;
}

function logTicks(min, max, maxCount = 5) {
  const span = max - min;
  const step = Math.max(1, Math.ceil(span / maxCount));
  const out = [];
  for (let t = Math.ceil(min); t <= Math.floor(max); t += step) out.push(t);
  return out;
}

function linTicks(min, max, count = 4) {
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out = [];
  for (let t = Math.ceil(min / step) * step; t <= max; t += step) out.push(t);
  return out;
}

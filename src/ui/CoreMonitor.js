/**
 * Core Monitor: a cutaway on a logarithmic radial scale showing the iron
 * core, the shock position inside the envelope and the stellar surface.
 * This is what the star's surface cannot show you — the collapse happens
 * deep inside and the surface stays unaware for hours.
 */
import { h } from './dom.js';
import { fmtLengthMeters } from '../core/units.js';
import { SOLAR_RADIUS_M } from '../core/constants.js';
import { clamp } from '../core/math.js';

export class CoreMonitor {
  constructor() {
    this.canvas = h('canvas', { class: 'core-canvas' });
    this.el = h('div', { class: 'core-monitor' }, this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  update(snap) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.el.clientWidth || 260;
    const size = Math.round(Math.min(w, 200));
    if (this.canvas.width !== size * dpr) { this.canvas.width = size * dpr; this.canvas.height = size * dpr; }
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2; const cy = size / 2; const maxR = size / 2 - 8;

    const Rstar = (snap.phase === 'supernova' ? snap.collapseState.R : snap.R) * SOLAR_RADIUS_M;
    const rMin = 1e4; // 10 km, neutron-star scale
    const toPx = (r) => maxR * clamp(Math.log10(Math.max(r, rMin) / rMin) / Math.log10(Rstar / rMin), 0, 1.15);

    // envelope
    const gEnv = ctx.createRadialGradient(cx, cy, 0, cx, cy, toPx(Rstar));
    const [cr, cg, cb] = snap.color;
    gEnv.addColorStop(0, `rgba(${cr * 255},${cg * 255},${cb * 255},0.05)`);
    gEnv.addColorStop(1, `rgba(${cr * 255},${cg * 255},${cb * 255},0.35)`);
    ctx.fillStyle = gEnv;
    ctx.beginPath(); ctx.arc(cx, cy, toPx(Rstar), 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // log rings
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let d = 1; d <= Math.log10(Rstar / rMin); d++) {
      ctx.beginPath(); ctx.arc(cx, cy, toPx(rMin * 10 ** d), 0, Math.PI * 2); ctx.stroke();
    }

    const sn = snap.sn;
    let coreR = 3e6; let coreLabel = 'core';
    if (sn) {
      coreR = sn.coreR;
      coreLabel = sn.remnantVisible ? 'remnant' : 'core';
    } else {
      coreR = 0.02 * Rstar * (snap.stage?.key === 'ms' ? 0.5 : 1);
      if (snap.stage?.instability) coreR = 3e6;
    }
    // shock
    if (sn && sn.Rshock > 0 && !sn.ejectaVisible) {
      const rs = toPx(sn.Rshock);
      ctx.strokeStyle = 'rgba(140,200,255,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, rs, 0, Math.PI * 2); ctx.stroke();
      const gs = ctx.createRadialGradient(cx, cy, Math.max(rs - 6, 0), cx, cy, rs);
      gs.addColorStop(0, 'rgba(140,200,255,0)');
      gs.addColorStop(1, 'rgba(140,200,255,0.35)');
      ctx.fillStyle = gs;
      ctx.beginPath(); ctx.arc(cx, cy, rs, 0, Math.PI * 2); ctx.fill();
    }
    if (sn && sn.ejectaVisible) {
      ctx.strokeStyle = 'rgba(140,200,255,0.5)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(cx, cy, toPx(Rstar) * 1.08, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    // core
    if (coreR > 0) {
      const rc = Math.max(toPx(coreR), 2);
      const hot = sn ? clamp(Math.log10(Math.max(sn.coreT, 1e6) / 1e8), 0, 1) : 0.2;
      ctx.fillStyle = `rgba(${255},${Math.round(200 - 120 * hot)},${Math.round(120 - 100 * hot)},0.9)`;
      ctx.beginPath(); ctx.arc(cx, cy, rc, 0, Math.PI * 2); ctx.fill();
    }
    // labels
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(200,210,235,0.8)';
    ctx.textAlign = 'center';
    ctx.fillText(`surface ${fmtLengthMeters(Rstar)}`, cx, cy - toPx(Rstar) - 3 < 12 ? 12 : cy - toPx(Rstar) - 3);
    ctx.fillText(`${coreLabel} ${fmtLengthMeters(coreR)}`, cx, cy + Math.max(toPx(coreR), 2) + 12);
    if (sn && sn.Rshock > 0 && !sn.ejectaVisible) {
      ctx.fillStyle = 'rgba(140,200,255,0.9)';
      ctx.fillText(`shock ${fmtLengthMeters(sn.Rshock)}`, cx, cy - toPx(sn.Rshock) - 4);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(160,172,200,0.6)';
    ctx.fillText('log radial scale', 6, size - 6);
  }
}

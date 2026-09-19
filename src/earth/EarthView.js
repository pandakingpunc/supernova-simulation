/**
 * Earth View: a 2D panoramic sky rendered on a canvas.
 *
 * Every frame it computes where the Sun, Moon, the bright stars and the
 * simulated star are for an observer at the chosen latitude, date and
 * local time, then draws sky, stars, horizon and the supernova with a
 * brightness taken from the light-curve model (apparent magnitude →
 * illuminance). Sky glow, limiting magnitude and ground illumination all
 * follow from that one number, which keeps the scene physically coherent.
 */
import { BRIGHT_STARS, CATALOG_TO_BRIGHT } from '../data/brightStars.js';
import { sunRaDec, localSiderealTime, altAz, moonApprox, nextRise, hourLabel, dateLabel, dayOfYear } from '../physics/skyMath.js';
import { apparentMagnitudes, illuminanceLux, brightnessComparison } from '../physics/earthEffects.js';
import { blackbodyRGB } from '../physics/blackbody.js';
import { makeRng, clamp, lerp, smoothstep, DEG } from '../core/math.js';
import { SOLAR_LUMINOSITY_W, MAG_SUN } from '../core/constants.js';

const GAL_POLE_RA = 192.859 * DEG;
const GAL_POLE_DEC = 27.128 * DEG;
const GAL_L_NCP = 122.932 * DEG;

/** Galactic (l, b) → equatorial (RA hours, Dec deg). */
function galacticToEquatorial(l, b) {
  const sinDec = Math.sin(GAL_POLE_DEC) * Math.sin(b) + Math.cos(GAL_POLE_DEC) * Math.cos(b) * Math.cos(GAL_L_NCP - l);
  const dec = Math.asin(clamp(sinDec, -1, 1));
  const y = Math.cos(b) * Math.sin(GAL_L_NCP - l);
  const x = Math.sin(b) * Math.cos(GAL_POLE_DEC) - Math.cos(b) * Math.sin(GAL_POLE_DEC) * Math.cos(GAL_L_NCP - l);
  const ra = GAL_POLE_RA + Math.atan2(y, x);
  return { raH: (((ra / DEG / 15) % 24) + 24) % 24, decDeg: dec / DEG };
}

function generateFieldStars() {
  const rng = makeRng(2024);
  const stars = [];
  for (let i = 0; i < 2600; i++) {
    const z = rng() * 2 - 1;
    const decDeg = Math.asin(z) / DEG;
    const raH = rng() * 24;
    const m = Math.log10(rng() * (10 ** 3.25 - 10 ** 1.25) + 10 ** 1.25) / 0.5; // 2.5 .. 6.5
    const T = Math.exp(Math.log(3200) + rng() * (Math.log(25000) - Math.log(3200)));
    stars.push({ raH, decDeg, mag: m, rgb: blackbodyRGB(T), name: null });
  }
  return stars;
}

function generateMilkyWay() {
  const rng = makeRng(99);
  const pts = [];
  for (let i = 0; i < 3200; i++) {
    let l;
    do { l = (rng() * 2 - 1) * Math.PI; } while (rng() > 0.3 + 0.7 * 0.5 * (1 + Math.cos(l)));
    const b = Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng()) * 5.5 * DEG;
    const eq = galacticToEquatorial(l, b);
    pts.push({ ...eq, a: 0.25 + rng() * 0.4 });
  }
  return pts;
}

function horizonProfile(azDeg) {
  const a = azDeg * DEG;
  return 1.6 + 1.1 * Math.sin(a * 3 + 0.4) + 0.7 * Math.sin(a * 7.3 + 2.1) + 0.45 * Math.sin(a * 17 + 1.3) + 0.3 * Math.sin(a * 41 + 0.7);
}

export class EarthView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = {
      latitude: 41,
      dayOfYear: dayOfYear(),
      hour: 22,
      autoAdvance: false,
      hoursPerSecond: 0.4,
      lookAz: 180,
      lookAlt: 22,
      fovDeg: 105,
    };
    this.fieldStars = generateFieldStars();
    this.milkyWay = generateMilkyWay();
    this.info = {};
    this.width = 1;
    this.height = 1;
    this.dragging = false;
    this.bindPointer();
  }

  bindPointer() {
    const c = this.canvas;
    let last = null;
    c.addEventListener('pointerdown', (e) => { this.dragging = true; last = [e.clientX, e.clientY]; c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove', (e) => {
      if (!this.dragging || !last) return;
      const pxPerDeg = this.width / this.state.fovDeg;
      this.state.lookAz = (this.state.lookAz - (e.clientX - last[0]) / pxPerDeg + 360) % 360;
      this.state.lookAlt = clamp(this.state.lookAlt + (e.clientY - last[1]) / pxPerDeg, -8, 75);
      last = [e.clientX, e.clientY];
    });
    const stop = () => { this.dragging = false; last = null; };
    c.addEventListener('pointerup', stop);
    c.addEventListener('pointercancel', stop);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.state.fovDeg = clamp(this.state.fovDeg * Math.exp(e.deltaY * 0.001), 45, 160);
    }, { passive: false });
  }

  setSize(w, h, dpr = 1) {
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  /** Look toward the simulated star (called by the UI's "Look at star" button). */
  lookAtStar() {
    if (this.info.starAz == null) return;
    this.state.lookAz = this.info.starAz;
    this.state.lookAlt = clamp(this.info.starAlt - 8, -8, 75);
  }

  /** Advance the local clock until the star is above the horizon. */
  jumpToStarRise() {
    const r = this.info.riseHour;
    if (r == null) return false;
    if (r < this.state.hour) this.state.dayOfYear = (this.state.dayOfYear % 365) + 1;
    this.state.hour = r;
    return true;
  }

  project(az, alt) {
    const s = this.state;
    const pxPerDeg = this.width / s.fovDeg;
    let dAz = ((az - s.lookAz + 540) % 360) - 180;
    return [this.width / 2 + dAz * pxPerDeg, this.height / 2 - (alt - s.lookAlt) * pxPerDeg, pxPerDeg];
  }

  render(earthSnap, dt) {
    const s = this.state;
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;
    if (s.autoAdvance) {
      s.hour += dt * s.hoursPerSecond;
      if (s.hour >= 24) { s.hour -= 24; s.dayOfYear = (s.dayOfYear % 365) + 1; }
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // --- positions ---
    const lst = localSiderealTime(s.dayOfYear, s.hour);
    const sunEq = sunRaDec(s.dayOfYear);
    const sun = altAz(sunEq.raH, sunEq.decDeg, lst, s.latitude);
    const moon = moonApprox(s.dayOfYear);
    const moonPos = altAz(moon.raH, moon.decDeg, lst, s.latitude);
    const star = earthSnap?.star;
    const isSun = !!star?.isSun;
    const starPos = star ? (isSun ? sun : altAz(star.ra, star.dec, lst, s.latitude)) : null;

    // --- supernova / star brightness ---
    let mV = null; let Tcol = 5800; let rgb = [1, 1, 1];
    if (star) {
      if (earthSnap.sn) { mV = apparentMagnitudes(earthSnap.sn.L, star.distanceLy, earthSnap.sn.Tcolor).mV; Tcol = earthSnap.sn.Tcolor; }
      else { mV = apparentMagnitudes(earthSnap.L * SOLAR_LUMINOSITY_W, star.distanceLy, earthSnap.T).mV; Tcol = earthSnap.T; }
      rgb = blackbodyRGB(Tcol);
    }
    const starUp = starPos && starPos.alt > horizonProfile(starPos.az);
    const snLux = starUp && mV != null ? illuminanceLux(mV) : 0;
    const sunLevel = smoothstep(-18, -6, sun.alt) * 0.08 + smoothstep(-6, 8, sun.alt) * 0.92;
    const sunUp = sun.alt > -0.8 && !(isSun && earthSnap.sn); // the Sun disc, unless it *is* the supernova
    const snLevel = clamp((Math.log10(snLux + 1e-6) + 1) / 6, 0, 1);
    const moonLux = moonPos.alt > 0 ? illuminanceLux(moon.magnitude) : 0;
    const skyLevel = clamp(Math.max(sunLevel, snLevel) + moonLux * 0.05, 0, 1);
    const mLim = 6.6 - 10.6 * Math.sqrt(skyLevel);

    // --- sky ---
    const night = [4, 6, 16];
    const day = [92, 150, 225];
    const snTint = [rgb[0] * 255, rgb[1] * 255, rgb[2] * 255];
    const skyCol = (f) => {
      const c = night.map((n, i) => lerp(n, day[i], sunLevel * f));
      return c.map((v, i) => lerp(v, Math.max(v, snTint[i] * 0.9 * f), snLevel));
    };
    const zen = skyCol(0.8).map(Math.round);
    const hor = skyCol(1.0).map((v) => Math.round(Math.min(255, v * 1.15 + 12)));
    const [, yHor] = this.project(s.lookAz, 0);
    const grad = ctx.createLinearGradient(0, 0, 0, Math.max(yHor, 1));
    grad.addColorStop(0, `rgb(${zen.join(',')})`);
    grad.addColorStop(1, `rgb(${hor.join(',')})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // twilight warmth around the Sun's azimuth
    if (sun.alt > -14 && sun.alt < 6) {
      const [sx] = this.project(sun.az, 0);
      const k = smoothstep(-14, -2, sun.alt) * (1 - smoothstep(0, 6, sun.alt)) * 0.7 + 0.1 * smoothstep(-2, 6, sun.alt);
      const g2 = ctx.createRadialGradient(sx, yHor, 0, sx, yHor, W * 0.6);
      g2.addColorStop(0, `rgba(255,140,60,${0.55 * k})`);
      g2.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, W, H);
    }

    // --- Milky Way & stars ---
    const drawStar = (raH, decDeg, mag, col, alphaMul = 1) => {
      const p = altAz(raH, decDeg, lst, s.latitude);
      if (p.alt < 0 || mag > mLim) return null;
      const [x, y] = this.project(p.az, p.alt);
      if (x < -10 || x > W + 10 || y < -10 || y > H + 10) return [x, y, p];
      const vis = clamp((mLim - mag) / 6, 0, 1.4);
      const r = 0.5 + vis * 1.6 + Math.max(0, -mag) * 0.5;
      ctx.fillStyle = `rgba(${Math.round(col[0] * 255)},${Math.round(col[1] * 255)},${Math.round(col[2] * 255)},${clamp(0.25 + vis, 0, 1) * alphaMul})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      return [x, y, p];
    };
    if (skyLevel < 0.25) {
      const a = (0.25 - skyLevel) / 0.25;
      ctx.fillStyle = `rgba(190,200,230,${0.35 * a})`;
      for (const p of this.milkyWay) {
        const q = altAz(p.raH, p.decDeg, lst, s.latitude);
        if (q.alt < 0) continue;
        const [x, y] = this.project(q.az, q.alt);
        if (x < 0 || x > W || y < 0 || y > H) continue;
        ctx.globalAlpha = p.a * a;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
    for (const f of this.fieldStars) drawStar(f.raH, f.decDeg, f.mag, f.rgb);
    const hideName = star && !star.custom ? CATALOG_TO_BRIGHT[star.id] : null;
    ctx.font = '11px system-ui, sans-serif';
    for (const [name, raH, decDeg, mag, T] of BRIGHT_STARS) {
      if (name === hideName) continue;
      const res = drawStar(raH, decDeg, mag, blackbodyRGB(T));
      if (res && mag < 1.2 && skyLevel < 0.35) {
        ctx.fillStyle = 'rgba(200,210,235,0.55)';
        ctx.fillText(name, res[0] + 6, res[1] - 6);
      }
    }

    // --- Sun ---
    if (sunUp) {
      const [x, y, pxPerDeg] = this.project(sun.az, sun.alt);
      const R = Math.max(4, 0.27 * pxPerDeg);
      const g = ctx.createRadialGradient(x, y, R, x, y, R * 14);
      g.addColorStop(0, 'rgba(255,250,235,0.9)');
      g.addColorStop(0.2, 'rgba(255,240,200,0.35)');
      g.addColorStop(1, 'rgba(255,230,180,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - R * 14, y - R * 14, R * 28, R * 28);
      ctx.fillStyle = '#fffbf0';
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    }

    // --- Moon ---
    if (moonPos.alt > -0.5) {
      const [x, y, pxPerDeg] = this.project(moonPos.az, moonPos.alt);
      const R = Math.max(3, 0.26 * pxPerDeg);
      const bright = clamp(moon.illuminated, 0.05, 1) * (1 - skyLevel * 0.6);
      const g = ctx.createRadialGradient(x, y, R, x, y, R * 8);
      g.addColorStop(0, `rgba(220,225,240,${0.5 * bright})`);
      g.addColorStop(1, 'rgba(220,225,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - R * 8, y - R * 8, R * 16, R * 16);
      // Phase: dark disc, lit half on the sunward side, terminator drawn as an ellipse
      const lit = `rgb(${Math.round(150 + 90 * bright)},${Math.round(152 + 90 * bright)},${Math.round(160 + 90 * bright)})`;
      const dark = `rgba(${zen[0] + 18},${zen[1] + 18},${zen[2] + 22},1)`;
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = dark;
      ctx.fillRect(x - R, y - R, 2 * R, 2 * R);
      const side = moon.waxing ? 1 : -1; // waxing Moon is lit on the western (right-hand) side
      ctx.fillStyle = lit;
      ctx.fillRect(side > 0 ? x : x - R, y - R, R, 2 * R);
      const ew = Math.abs(Math.cos(moon.elongation)) * R;
      ctx.fillStyle = moon.illuminated > 0.5 ? lit : dark;
      ctx.beginPath(); ctx.ellipse(x, y, Math.max(ew, 0.01), R, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (skyLevel < 0.5) {
        ctx.fillStyle = 'rgba(200,210,235,0.6)';
        ctx.fillText(`Moon  (${Math.round(moon.illuminated * 100)}%, m ≈ ${moon.magnitude.toFixed(1)})`, x + R + 6, y + 4);
      }
    }

    // --- supernova / star ---
    let riseHour = null;
    if (star && starPos) {
      const [x, y, pxPerDeg] = this.project(starPos.az, starPos.alt);
      if (starUp) {
        if (mV <= mLim + 1.5) {
          const bright = -4 - mV; // >0 once brighter than Venus
          const core = bright > 0 ? 3 + bright * 0.45 : Math.max(1, 1 + (mLim - mV) * 0.35);
          const glowR = bright > 0 ? 10 + bright * 14 : core * 3;
          const col = `${Math.round(rgb[0] * 255)},${Math.round(rgb[1] * 255)},${Math.round(rgb[2] * 255)}`;
          const g = ctx.createRadialGradient(x, y, core * 0.5, x, y, glowR);
          g.addColorStop(0, `rgba(${col},${clamp(0.6 + bright * 0.05, 0, 0.95)})`);
          g.addColorStop(0.3, `rgba(${col},${clamp(0.25 + bright * 0.02, 0, 0.6)})`);
          g.addColorStop(1, `rgba(${col},0)`);
          ctx.fillStyle = g;
          ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);
          if (bright > 4) {
            // diffraction-like rays, a hint of what a point source this bright does to the eye
            ctx.save();
            ctx.translate(x, y);
            ctx.strokeStyle = `rgba(${col},0.35)`;
            ctx.lineWidth = 1.2;
            const len = glowR * 1.8;
            for (let k = 0; k < 6; k++) {
              ctx.rotate(Math.PI / 6);
              ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(len, 0); ctx.stroke();
            }
            ctx.restore();
          }
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(x, y, core, 0, Math.PI * 2); ctx.fill();
        }
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(`${star.name}   m = ${mV.toFixed(1)}`, clamp(x + 14, 8, W - 180), clamp(y - 10, 60, H - 20));
      } else {
        riseHour = nextRise(isSun ? sunEq.raH : star.ra, isSun ? sunEq.decDeg : star.dec, s.latitude, s.dayOfYear, s.hour, 4);
        const yh = this.project(starPos.az, Math.max(horizonProfile(starPos.az), 0))[1];
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,200,120,0.9)';
        ctx.fillText(`▽ ${star.name} is below the horizon` + (riseHour != null ? ` — rises ~${hourLabel(riseHour)}` : ''), clamp(x, 8, W - 260), clamp(yh - 12, 20, H - 20));
      }
    }

    // --- ground ---
    const totalLux = (sunUp ? 1.05e5 * Math.max(0, Math.sin(sun.alt * DEG)) : 0) + snLux + moonLux;
    const light = clamp(Math.pow(totalLux / 4e4, 0.45), 0, 1);
    const gr = [lerp(8, 120, light) * (0.6 + 0.4 * rgb[0]), lerp(10, 130, light) * (0.6 + 0.4 * rgb[1]), lerp(16, 125, light) * (0.6 + 0.4 * rgb[2])].map(Math.round);
    ctx.fillStyle = `rgb(${gr.join(',')})`;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const pxPerDeg = W / s.fovDeg;
    for (let x = 0; x <= W; x += 4) {
      const az = s.lookAz + (x - W / 2) / pxPerDeg;
      const y = H / 2 - (horizonProfile(az) - s.lookAlt) * pxPerDeg;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    // cardinal points
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (const [az, label] of [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W'], [45, 'NE'], [135, 'SE'], [225, 'SW'], [315, 'NW']]) {
      const [x] = this.project(az, 0);
      if (x < 0 || x > W) continue;
      const y = H / 2 - (horizonProfile(az) - s.lookAlt) * pxPerDeg;
      ctx.fillText(label, x - 4, y + 16);
    }

    this.info = {
      mV, lux: snLux, mLim, skyLevel, starAlt: starPos?.alt, starAz: starPos?.az, starUp,
      sunAlt: sun.alt, moon, moonUp: moonPos.alt > 0, riseHour, isSun,
      comparison: mV != null ? brightnessComparison(mV) : null,
      timeLabel: `${dateLabel(s.dayOfYear)} ${hourLabel(s.hour)}`,
      Tcol,
    };
    return this.info;
  }
}

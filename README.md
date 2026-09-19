# Supernova Simulation

[![Deploy to GitHub Pages](https://github.com/pandakingpunc/supernova-simulation/actions/workflows/deploy.yml/badge.svg)](https://github.com/pandakingpunc/supernova-simulation/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.XXXXXXX.svg)](https://doi.org/10.5281/zenodo.XXXXXXX)

**Live demo:** <https://pandakingpunc.github.io/supernova-simulation/>

An interactive, physically-motivated simulation of how stars die, running entirely in the browser.
Pick a real star (or build your own), fast-forward its evolution, watch the core collapse and the
ejecta expand from up close, then step outside and see what the explosion looks like from Earth —
including the years or centuries the light needs to get here.

Everything is procedural: no textures, no datasets, no backend, no API keys. The whole project is a
normal-sized web repository (the built site is under 1 MB).

> **Scientific honesty.** This is an educational model, not a hydrodynamics code. Every value in the
> interface is tagged **Observed** (literature data), **Estimated** (published scaling relations) or
> **Simulation** (this app's approximations). Nobody knows when any real star will explode.

---

## Features

- **Star Library** — ten well-known stars (Betelgeuse, Antares, Rigel, Spica, VY Canis Majoris,
  Eta Carinae, Sirius A, Vega, the Sun, Proxima Centauri) with observed mass, radius, temperature,
  luminosity, age, distance and sky position, plus the model's expected fate and remnant.
- **Stellar Evolution** — mass-dependent evolution tracks (main sequence → giant branches / red
  supergiant → late burning stages → collapse, or planetary nebula → white dwarf for low-mass stars).
  Time controls: Pause, Real Time, 10×, 1,000×, 1 Million×, and *Stellar Evolution Mode*, which
  compresses the rest of the star's life into about a minute.
- **Supernova model** — core collapse, bounce, shock propagation, shock breakout, plateau /
  radioactive light curve, free expansion and Sedov–Taylor phase, evaluated analytically at any
  instant. *Cinematic* time compression gives every decade of explosion time (0.1 s → 1 s → … →
  10,000 yr) the same few seconds of screen time.
- **Close Observation Mode** — WebGL scene at true relative scale (1 unit = 1 R☉) with a procedural
  photosphere, corona, GPU-particle ejecta (two velocity layers, clumping, cooling colours), a fresnel
  shock front and cinematic camera presets: Orbit, Surface Proximity, Wide System, Explosion Front,
  Remnant, Free.
- **Scientific Data Panel** — live core temperature/density, radii, luminosity, ejecta and shock
  velocity, kinetic / radiated / neutrino energy, bound mass, and four live charts (luminosity,
  radius, core temperature, shock radius). A *Core Monitor* cutaway shows the collapse the surface
  cannot.
- **Earth View** — a panoramic night sky for any latitude, date and local time with the real bright
  stars, Sun, Moon (phase and brightness), twilight, a horizon and the supernova at its computed
  apparent magnitude. Sky glow, limiting magnitude and ground illumination all follow from the light
  curve.
- **Light travel time** — *Respect light travel time* delays what Earth sees by distance / c; the
  "Event occurred / Light reaches Earth" readout and a *Jump to light arrival* button make the
  point that we always look into the past. Near the star the remnant is already centuries old.
- **Earth Impact** — peak magnitude and illuminance compared with Sirius, the Moon and the Sun, plus
  order-of-magnitude estimates of ozone depletion, UV-B increase, cosmic-ray flux, neutrino dose and
  shell arrival time, with a risk tier from *spectacular but harmless* to *sterilizing*.
- **Create Your Own Star** — Basic mode (mass, age, distance, sky position) and Advanced mode
  (metallicity, rotation, radius/temperature overrides). Live prediction of classification, colour,
  luminosity, lifetime, evolutionary path and final state. Save presets locally.
- **Forced / experimental scenarios** — stars that would never explode can be pushed into a forced
  core collapse (M ≥ 1.4 M☉) or a thermonuclear disruption (M < 1.4 M☉). These are clearly labelled
  as experiments, never predictions.
- **Remnants** — white dwarf (with planetary nebula), neutron star, pulsar (rotating beams and dipole
  field lines), magnetar (flares), black hole (horizon, fallback disk, photon ring) or nothing at all
  (pair instability / thermonuclear). Rendered at true scale; use *Remnant View* to zoom 10⁷×.
- **Compare Supernovae** — any two stars (catalogue, saved or reference stars) side by side: energy,
  peak luminosity, ejecta velocity, timeline, remnant, brightness from Earth.
- **Timeline / Event Log** — computed events from "core instability detected" to "remnant merges with
  the interstellar medium"; click any event to jump there.
- **Performance** — Low / Medium / High / Ultra quality presets (pixel ratio, bloom, particle count,
  mesh detail) with automatic downgrade on slow machines. Only a few kilobytes of localStorage are
  used (settings and saved stars).

## Installation

Requires Node.js 18+.

```bash
git clone https://github.com/pandakingpunc/supernova-simulation.git
cd supernova-simulation
npm install
```

## Development

```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run check:physics  # sanity checks of the physics layer (no browser needed)
```

## Build

```bash
npm run build        # static site in dist/
npm run preview      # serve the production build locally
```

## Deployment

The build is a static site with relative asset paths, so it works from any sub-path.

- **GitHub Pages**: the included workflow (`.github/workflows/deploy.yml`) builds and deploys `dist/`
  on every push to `main`. Enable *Settings → Pages → Source: GitHub Actions* once.
- **Netlify / Vercel**: build command `npm run build`, publish directory `dist`.
- Any static host: upload the contents of `dist/`.

No backend and no environment variables are needed.

## Controls

| Action | Control |
| --- | --- |
| Orbit the camera | drag |
| Zoom | mouse wheel |
| Camera presets | `1`–`5` or the *Camera* menu |
| Pause / play | `Space` |
| Earth View / Close Observation | `E` / `C` |
| Hide / show the interface | `H` |
| Look around (Earth View) | drag; wheel changes field of view |
| Jump on the timeline | click an event in *Science → Timeline* |

## Project structure

```
src/
  core/       constants, units, math, state store, localStorage
  physics/    stellar model, evolution tracks, supernova model, remnants,
              Earth effects, sky geometry, blackbody colours
  data/       star catalogue, bright-star list for the Earth sky
  sim/        Simulation clock, star factory
  render/     Three.js scene: star, ejecta, shock, remnant, starfield,
              camera rig, GLSL shaders, quality presets
  earth/      2D canvas Earth View
  ui/         panels, charts, core monitor, app wiring
scripts/      physics sanity checks
```

## Simulation limitations

- The explosion is an analytic parametric model, not a hydrodynamic simulation. Shapes of the
  ejecta, filaments and the shock front are procedural art guided by the model's radii and
  luminosities.
- Stellar evolution is a sequence of representative stages with interpolated properties; there is no
  stellar-structure integration. Mass loss, binarity, magnetic fields and rotation are handled by
  simple rules.
- The neutron-star / black-hole boundary, magnetar formation and pair-instability window are
  simplified from the literature; real outcomes depend on details that are still debated.
- Pulsar rotation is slowed to ~1 revolution per second for visibility.
- The Earth View uses a simplified atmosphere and a panoramic projection; it is meant to give the
  right impression of brightness and position, not a planetarium-grade sky.
- Environmental effects are order-of-magnitude scalings, appropriate for education only.

## Scientific approximations (what the numbers come from)

| Quantity | Approximation |
| --- | --- |
| Main-sequence luminosity / radius / lifetime | Mass–luminosity power laws, R ∝ M^0.57 (M > 1), τ = 10¹⁰ yr · M / L |
| Late burning stages | Representative durations and core conditions (C: ~10³ yr, Ne: ~1 yr, O: ~0.5 yr, Si: ~1 day) |
| Collapse timing | Infall 0.05 s, bounce 0.25 s, shock stall 0.3 s, neutrino-driven revival 0.5 s |
| Explosion energy | ~10⁵¹ erg scaled weakly with mass; hypernova 2×10⁵² erg; pair instability up to 10⁵³ erg |
| Ejecta velocity | Uniform-sphere kinetic energy E = 3/10 · M · v_max² |
| Shock breakout | t = R / 10⁴ km s⁻¹; flash luminosity ~10⁴⁵ erg/s for a red supergiant |
| Plateau (Type II-P) | Popov (1993) scaling: L ∝ R^(2/3) E^(5/6) M^(-1/2), t ∝ R^(1/6) E^(-1/6) M^(1/2) |
| Radioactive tail | ⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe decay powers (Nadyozhin 1994) with an Arnett-style diffusion rise and late gamma-ray leakage |
| Neutrino burst | 3×10⁵³ erg over ~3 s (SN 1987A) |
| Remnant evolution | Free expansion until swept ISM mass = ejecta mass (n = 1 cm⁻³), then Sedov–Taylor R ∝ t^(2/5) |
| Remnant type | White dwarf < 8 M☉ (Kalirai 2008 initial–final mass relation); neutron star 8–~20 M☉; black hole above, metallicity dependent; pair instability 140–260 M☉ at low Z |
| Apparent magnitude | M_bol = 4.74 − 2.5 log₁₀(L/L☉), inverse-square law, approximate bolometric correction |
| Ozone depletion | ~47% at 8 pc for a canonical supernova (Gehrels et al. 2003), scaled ∝ E / d² |
| Kill distance | ~8–10 pc (Fields et al. 2020) |
| Neutrino dose | ~5 Sv at 2.3 AU for a 10⁵³ erg burst, ∝ 1/d² |
| Sky positions | Local sidereal time from date and local solar time; Sun on the ecliptic; Moon from its synodic age |

## License

MIT — see `LICENSE`. It lets anyone use, modify and redistribute the simulation (including for
teaching) with attribution, and matches the license of Three.js.

## Citation

If you use this simulation in teaching, outreach or research, please cite the archived release on
Zenodo. GitHub also offers a *Cite this repository* button that reads [`CITATION.cff`](CITATION.cff).

```bibtex
@software{karatum_supernova_simulation_2026,
  author    = {Karatum, Mustafa},
  title     = {Supernova Simulation},
  version   = {1.0.0},
  year      = {2026},
  publisher = {Zenodo},
  doi       = {10.5281/zenodo.XXXXXXX},
  url       = {https://github.com/pandakingpunc/supernova-simulation}
}
```

Replace `10.5281/zenodo.XXXXXXX` with the concept DOI issued by Zenodo after the first release.
Release notes are kept in [`CHANGELOG.md`](CHANGELOG.md); Zenodo metadata is in
[`.zenodo.json`](.zenodo.json).

## Acknowledgements

Built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). Simplex noise by
Ashima Arts / Stefan Gustavson (MIT). Star data from SIMBAD and the astronomical literature.

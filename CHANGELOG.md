# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-10-05

### Changed
- Red-supergiant radius is capped at 1500 R☉ (luminosity kept, temperature from Stefan–Boltzmann);
  stars above ~25 M☉ now end as warmer yellow hypergiants.
- Eta Carinae A uses an effective radius of 80 R☉, consistent with its temperature and luminosity.
- Ozone depletion scales linearly with explosion energy (∝ E/d²), as documented; hypernovae and
  pair-instability events now reach higher risk tiers.
- The reported optical peak is the plateau / radioactive maximum, not the shock-cooling tail.

### Fixed
- Number formatting: `sci()` dropped integer zeros (100 → "1") and printed "e+3"; doubled SI
  prefixes ("10.0 k km/s"); unit rollover ("60.0 s", "1000 yr"); sub-year stage durations as "0.0 yr".
- Discontinuities in luminosity, colour temperature, shock velocity, core state and instability at
  core bounce, shock breakout, the end of the plateau and the Sedov transition; evolution-track
  jumps at stage boundaries and at 25 M☉.
- Stellar classification of low-mass giants, O subtypes, white-dwarf progenitors and massive
  main-sequence stars; catalogue lifetimes shorter than the star's age.
- Simulation clock: lost increments in Real/10×/1000× evolution, cinematic origin after
  "Jump to light arrival", negative ages, chart history after seeking, phantom nebulae around helium
  white dwarfs, forced explosions after evolution ended.
- Controls: double-firing Trigger button, Space not resuming, shortcuts firing with modifiers or
  auto-repeat, jump buttons recreated every tick, Hide UI still capturing clicks (and no touch way
  back), Escape on the intro.
- Earth View: sky locked to 2026, Sun counted and drawn twice in the Sun scenario, Moon lit limb
  facing the wrong way, Moon age offset, day-quantised Sun/Moon positions, horizon seam, wheel
  `deltaMode`, light-arrival thresholds and labels.
- Rendering: pulsar beams fading at half length, Low quality skipping tone mapping, ineffective
  bloom scale, unbounded free-camera distance, undisposed remnant resources.
- Storage: corrupt or tampered `localStorage` no longer blanks the app; failed saves are reported.
- UI: timeline showing another star's events, literal "null" text, provenance tags for custom stars,
  narrow-screen layout, keyboard and screen-reader access, long star names, chart axis ticks.
- Documentation: neutrino-dose calibration (3×10⁵³ erg) and cinematic time range.

### Added
- Regression checks for the fixes above in `npm run check:physics`.

## [1.0.0] - 2026-09-19

First public release.

### Added
- Star Library with ten well-known stars and their observed properties.
- Mass-dependent stellar evolution tracks with time controls and Stellar Evolution Mode.
- Analytic supernova model: collapse, bounce, shock breakout, plateau / radioactive light curve,
  free expansion and Sedov–Taylor phase, with cinematic time compression.
- Close Observation Mode: WebGL scene at true relative scale with procedural photosphere, corona,
  GPU-particle ejecta, shock front and cinematic camera presets.
- Scientific Data Panel with live quantities, four charts and a Core Monitor cutaway.
- Earth View: panoramic night sky for any latitude, date and time, with light travel time.
- Earth Impact panel with brightness comparisons and order-of-magnitude environmental estimates.
- Create Your Own Star (Basic and Advanced modes) with local presets.
- Forced / experimental explosion scenarios, clearly labelled.
- Remnant rendering: white dwarf, neutron star, pulsar, magnetar, black hole, or nothing.
- Compare Supernovae, Timeline / Event Log and quality presets with automatic downgrade.
- Physics sanity-check script (`npm run check:physics`) and GitHub Pages deployment workflow.
- Citation metadata (`CITATION.cff`, `.zenodo.json`) for archiving on Zenodo.

[1.1.0]: https://github.com/pandakingpunc/supernova-simulation/releases/tag/v1.1.0
[1.0.0]: https://github.com/pandakingpunc/supernova-simulation/releases/tag/v1.0.0

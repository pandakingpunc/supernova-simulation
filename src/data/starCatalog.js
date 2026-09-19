/**
 * Star library. Observed values are representative literature values
 * (SIMBAD / recent papers); ranges note the real uncertainty where it is
 * large. `currentStageKey` and `stageProgress` locate the star on its model
 * evolution track — a judgement, not an observation.
 *
 * Fields: mass (M☉), radius (R☉), temperature (K), luminosity (L☉, bolometric),
 * ageYr, distanceLy, ra (hours), dec (degrees), metallicity (Z), rotation
 * (fraction of break-up velocity).
 */
export const STAR_CATALOG = [
  {
    id: 'betelgeuse', name: 'Betelgeuse', designation: 'α Orionis', constellation: 'Orion',
    type: 'M1–2 Ia–ab', mass: 17, massRange: '16–19', radius: 764, radiusRange: '640–1000',
    temperature: 3600, luminosity: 126000, luminosityRange: '(0.9–1.5)×10⁵', ageYr: 8.5e6, ageRange: '8–8.5 Myr',
    distanceLy: 548, distanceRange: '500–650', ra: 5.9195, dec: 7.407, metallicity: 0.0134, rotation: 0.03,
    currentStageKey: 'rsg', stageProgress: 0.8,
    supernovaPotential: 'high',
    supernovaWindow: 'Sometime in the next ~100,000 years (possibly much sooner, possibly later)',
    blurb: 'The archetypal red supergiant and the most famous supernova candidate in the sky. Its Great Dimming of 2019–20 was a dust cloud, not a prelude to collapse.',
  },
  {
    id: 'antares', name: 'Antares', designation: 'α Scorpii A', constellation: 'Scorpius',
    type: 'M1.5 Iab–Ib', mass: 12, massRange: '11–14', radius: 680, radiusRange: '680–800',
    temperature: 3660, luminosity: 75900, ageYr: 1.5e7, ageRange: '11–15 Myr',
    distanceLy: 550, distanceRange: '470–620', ra: 16.4901, dec: -26.432, metallicity: 0.0134, rotation: 0.03,
    currentStageKey: 'rsg', stageProgress: 0.6,
    supernovaPotential: 'high',
    supernovaWindow: 'Within the next ~1 million years',
    blurb: 'The "rival of Mars", a red supergiant so large that it would engulf the orbit of Mars. A hot blue companion orbits inside its extended wind.',
  },
  {
    id: 'rigel', name: 'Rigel', designation: 'β Orionis A', constellation: 'Orion',
    type: 'B8 Ia', mass: 21, massRange: '18–24', radius: 74, radiusRange: '70–80',
    temperature: 12100, luminosity: 120000, luminosityRange: '(1.2–2.8)×10⁵', ageYr: 8e6, ageRange: '7–9 Myr',
    distanceLy: 860, distanceRange: '790–930', ra: 5.2423, dec: -8.2017, metallicity: 0.0134, rotation: 0.1,
    currentStageKey: 'hgap', stageProgress: 0.25,
    supernovaPotential: 'high',
    supernovaWindow: 'Within the next ~1–2 million years, after passing through a red supergiant phase',
    blurb: 'A blue supergiant already leaving the main sequence. Whether it explodes as a blue or a red supergiant (like SN 1987A vs. a Type II-P) is an open question.',
  },
  {
    id: 'spica', name: 'Spica', designation: 'α Virginis A', constellation: 'Virgo',
    type: 'B1 III–IV', mass: 11.4, massRange: '10–12', radius: 7.5,
    temperature: 25300, luminosity: 20500, ageYr: 1.25e7,
    distanceLy: 250, distanceRange: '240–260', ra: 13.4199, dec: -11.161, metallicity: 0.0134, rotation: 0.35,
    currentStageKey: 'ms', stageProgress: 0.85,
    supernovaPotential: 'likely',
    supernovaWindow: 'In a few million years; the closest massive star likely to explode',
    blurb: 'A close binary of two hot B stars. The primary is massive enough for core collapse and, at 250 light-years, is one of the nearest supernova progenitors.',
  },
  {
    id: 'vy-cma', name: 'VY Canis Majoris', designation: 'VY CMa', constellation: 'Canis Major',
    type: 'M2.5–M5 Ia', mass: 17, massRange: '15–20', radius: 1420, radiusRange: '1300–1500',
    temperature: 3490, luminosity: 270000, ageYr: 8.2e6,
    distanceLy: 3900, distanceRange: '3800–4000', ra: 7.3829, dec: -25.7675, metallicity: 0.0134, rotation: 0.02,
    currentStageKey: 'rsg', stageProgress: 0.9,
    supernovaPotential: 'high',
    supernovaWindow: 'Within ~100,000 years; heavy mass loss may strip it first',
    blurb: 'One of the largest known stars, shedding its envelope in violent outbursts. Its shock breakout would take more than a day to cross the bloated envelope.',
  },
  {
    id: 'eta-carinae', name: 'Eta Carinae A', designation: 'η Carinae', constellation: 'Carina',
    type: 'LBV (O-type hypergiant)', mass: 100, massRange: '90–120', radius: 240, radiusRange: '60–800',
    temperature: 30000, luminosity: 4.6e6, ageYr: 3e6, ageRange: '2–3 Myr',
    distanceLy: 7500, ra: 10.751, dec: -59.684, metallicity: 0.0134, rotation: 0.4,
    currentStageKey: 'lbv', stageProgress: 0.5,
    supernovaPotential: 'high',
    supernovaWindow: 'Possibly within the next ~100,000 years; a candidate for a pair-instability-like or stripped-envelope event',
    blurb: 'A luminous blue variable that ejected ~20 M☉ in the Great Eruption of 1843. The radius is ill-defined because its wind is optically thick.',
  },
  {
    id: 'sirius', name: 'Sirius A', designation: 'α Canis Majoris A', constellation: 'Canis Major',
    type: 'A1 V', mass: 2.06, radius: 1.71,
    temperature: 9940, luminosity: 25.4, ageYr: 2.4e8, ageRange: '230–250 Myr',
    distanceLy: 8.6, ra: 6.7525, dec: -16.716, metallicity: 0.02, rotation: 0.04,
    currentStageKey: 'ms', stageProgress: 0.25,
    supernovaPotential: 'none',
    supernovaWindow: 'Never: it will become a white dwarf in ~1 billion years',
    blurb: 'The brightest star in the night sky, orbited by a white dwarf that was once the more massive star of the pair.',
  },
  {
    id: 'vega', name: 'Vega', designation: 'α Lyrae', constellation: 'Lyra',
    type: 'A0 V', mass: 2.14, radius: 2.36, radiusRange: '2.26 (pole) – 2.73 (equator)',
    temperature: 9600, luminosity: 40, ageYr: 4.55e8,
    distanceLy: 25.04, ra: 18.6156, dec: 38.784, metallicity: 0.006, rotation: 0.9,
    currentStageKey: 'ms', stageProgress: 0.5,
    supernovaPotential: 'none',
    supernovaWindow: 'Never: a white dwarf awaits it',
    blurb: 'Spinning at ~90% of break-up speed, Vega is visibly flattened. Its rapid rotation makes it an interesting experimental subject for a forced collapse.',
  },
  {
    id: 'sun', name: 'Sun', designation: 'Sol', constellation: '—',
    type: 'G2 V', mass: 1, radius: 1, temperature: 5772, luminosity: 1, ageYr: 4.6e9,
    distanceLy: 1.5813e-5, ra: 0, dec: 0, metallicity: 0.0134, rotation: 0.004, isSun: true,
    currentStageKey: 'ms', stageProgress: 0.46,
    supernovaPotential: 'none',
    supernovaWindow: 'Never: red giant in ~5 billion years, then a white dwarf',
    blurb: 'Our own star. Far too light to explode — but this simulation lets you force it, mostly to appreciate what 1 AU would mean.',
  },
  {
    id: 'proxima', name: 'Proxima Centauri', designation: 'α Centauri C', constellation: 'Centaurus',
    type: 'M5.5 Ve', mass: 0.122, radius: 0.154, temperature: 3000, luminosity: 0.0017, ageYr: 4.85e9,
    distanceLy: 4.2465, ra: 14.4953, dec: -62.679, metallicity: 0.015, rotation: 0.01,
    currentStageKey: 'ms', stageProgress: 0.006,
    supernovaPotential: 'none',
    supernovaWindow: 'Never: it will burn hydrogen for trillions of years',
    blurb: 'The nearest star to the Sun, a flare-prone red dwarf with at least one planet in its habitable zone.',
  },
];

export const catalogById = (id) => STAR_CATALOG.find((s) => s.id === id);

export const POTENTIAL_LABELS = {
  high: { text: 'Supernova progenitor', cls: 'chip-hot' },
  likely: { text: 'Likely progenitor', cls: 'chip-warm' },
  none: { text: 'No natural supernova', cls: 'chip-cool' },
};

/**
 * Stellar remnant prediction.
 *
 * Boundaries follow the standard picture (Heger et al. 2003, Woosley &
 * Janka 2005): initial mass and metallicity decide whether a star leaves a
 * white dwarf, a neutron star, a black hole, or nothing at all
 * (pair-instability). Rotation decides the neutron-star "flavour" here —
 * a simplification: real magnetar formation also depends on the dynamo and
 * fallback, which are not modelled.
 */
import {
  HELIUM_WD_MASS_LIMIT, MIN_CORE_COLLAPSE_MASS, NS_BH_BOUNDARY_MASS, WOLF_RAYET_MASS,
  PISN_MIN_MASS, PISN_MAX_MASS, CHANDRASEKHAR_MASS, TOV_MASS_LIMIT,
  NEUTRON_STAR_RADIUS_M, WHITE_DWARF_RADIUS_M, SOLAR_METALLICITY, SOLAR_MASS_KG, G, C,
} from '../core/constants.js';
import { clamp } from '../core/math.js';

export const REMNANT_INFO = {
  'helium-white-dwarf': {
    name: 'Helium white dwarf',
    short: 'He white dwarf',
    description:
      'A star below ~0.5 M☉ never gets hot enough to fuse helium. After a main-sequence life of hundreds of billions of years — far longer than the current age of the Universe — it contracts into an Earth-sized ball of degenerate helium that slowly cools forever.',
  },
  'white-dwarf': {
    name: 'Carbon–oxygen white dwarf',
    short: 'CO white dwarf',
    description:
      'Stars up to ~8 M☉ shed their envelopes as a planetary nebula and leave a carbon–oxygen core supported by electron degeneracy pressure. Roughly the mass of the Sun packed into the volume of the Earth, with a surface starting above 100,000 K.',
  },
  'neutron-star': {
    name: 'Neutron star',
    short: 'Neutron star',
    description:
      'The collapsed iron core: about 1.4 M☉ compressed into a ~24 km sphere at nuclear density. A teaspoon of its interior would weigh about a billion tonnes. Slow-rotating or with a weak magnetic field, it is seen mainly by its cooling thermal glow.',
  },
  pulsar: {
    name: 'Pulsar',
    short: 'Pulsar',
    description:
      'A rapidly rotating, strongly magnetised neutron star. Beams of radiation from the magnetic poles sweep past Earth like a lighthouse, producing pulses with clock-like regularity. The Crab pulsar (born in the supernova of 1054 AD) spins 30 times per second.',
  },
  magnetar: {
    name: 'Magnetar',
    short: 'Magnetar',
    description:
      'A neutron star with a magnetic field of ~10¹⁵ gauss, a thousand times stronger than an ordinary pulsar. Field decay powers X-ray flares and occasional giant gamma-ray outbursts. Formation likely requires a rapidly rotating progenitor core.',
  },
  'black-hole': {
    name: 'Stellar-mass black hole',
    short: 'Black hole',
    description:
      'When the proto-neutron star exceeds ~2–3 M☉ (through fallback of ejecta or direct collapse) nothing can support it and an event horizon forms. Stellar black holes from single stars are typically 5–20 M☉ with horizons only a few tens of kilometres across.',
  },
  none: {
    name: 'No remnant',
    short: 'Total disruption',
    description:
      'The star is completely unbound. In a thermonuclear (Type Ia-like) or pair-instability explosion the runaway burning releases more energy than the binding energy of the whole star, leaving only an expanding cloud of freshly synthesised elements.',
  },
};

/** Schwarzschild radius in metres for a mass in solar masses. */
export function schwarzschildRadius(massSolar) {
  return (2 * G * massSolar * SOLAR_MASS_KG) / (C * C);
}

/**
 * Predict the compact remnant.
 * @param {object} p
 * @param {number} p.mass initial mass (M☉)
 * @param {number} p.metallicity mass fraction Z
 * @param {number} p.rotation 0..1 fraction of break-up rotation
 * @param {string} p.scenario 'natural' | 'forced-collapse' | 'thermonuclear' | 'pisn' | 'hypernova'
 */
export function predictRemnant({ mass, metallicity = SOLAR_METALLICITY, rotation = 0.05, scenario = 'natural' }) {
  const zRel = metallicity / SOLAR_METALLICITY;
  const make = (type, remnantMass, extra = {}) => ({
    type,
    mass: remnantMass,
    radiusM: radiusFor(type, remnantMass),
    ...REMNANT_INFO[type],
    ...extra,
  });

  if (scenario === 'thermonuclear' || scenario === 'pisn') return make('none', 0);

  if (scenario === 'forced-collapse') {
    // Artificial: the core is forced past the Chandrasekhar limit.
    const m = clamp(0.4 * mass + 0.6, 1.25, TOV_MASS_LIMIT - 0.1);
    return neutronStarFlavour(make, m, rotation, true);
  }

  if (scenario === 'hypernova') {
    return make('black-hole', Math.max(3, 0.35 * mass), { viaFallback: true });
  }

  if (mass < HELIUM_WD_MASS_LIMIT) return make('helium-white-dwarf', Math.min(mass, 0.45));

  if (mass < MIN_CORE_COLLAPSE_MASS) {
    // Initial–final mass relation (Kalirai et al. 2008), capped below Chandrasekhar.
    const m = clamp(0.109 * mass + 0.394, 0.4, CHANDRASEKHAR_MASS - 0.05);
    return make('white-dwarf', m);
  }

  // Pair instability: only at low metallicity, otherwise winds strip the star first.
  if (mass >= PISN_MIN_MASS && mass <= PISN_MAX_MASS && zRel < 0.3) return make('none', 0);
  if (mass > PISN_MAX_MASS) return make('black-hole', 0.5 * mass, { direct: true });

  // Neutron star / black hole boundary shifts with metallicity (mass loss).
  const nsBhBoundary = clamp(NS_BH_BOUNDARY_MASS * Math.pow(zRel, 0.15), 15, 28);
  if (mass < nsBhBoundary) {
    const m = clamp(1.2 + 0.03 * (mass - MIN_CORE_COLLAPSE_MASS), 1.2, TOV_MASS_LIMIT - 0.1);
    return neutronStarFlavour(make, m, rotation, false);
  }

  // Black hole: strong winds at solar metallicity keep the mass modest.
  const retained = zRel > 0.5 ? 0.3 : 0.6;
  const m = Math.max(3, retained * mass);
  return make('black-hole', m, { viaFallback: mass < WOLF_RAYET_MASS });
}

function neutronStarFlavour(make, m, rotation, forced) {
  if (rotation >= 0.7) {
    return make('magnetar', m, { spinPeriod0: 0.003, spinDownYr: 30, bField: 1e15, forced });
  }
  if (rotation >= 0.02) {
    // Most core-collapse neutron stars are born as pulsars (Crab-like, P ~ 10–100 ms).
    return make('pulsar', m, { spinPeriod0: 0.012 + 0.08 * (0.7 - rotation), spinDownYr: 8000, bField: 1e12, forced });
  }
  return make('neutron-star', m, { spinPeriod0: 0.3, spinDownYr: 1e6, bField: 1e11, forced });
}

function radiusFor(type, mass) {
  switch (type) {
    case 'helium-white-dwarf':
    case 'white-dwarf':
      // WD mass–radius: R ∝ M^(-1/3), normalised to ~1 Earth radius at 0.6 M☉
      return WHITE_DWARF_RADIUS_M * Math.pow(mass / 0.6, -1 / 3);
    case 'neutron-star':
    case 'pulsar':
    case 'magnetar':
      return NEUTRON_STAR_RADIUS_M;
    case 'black-hole':
      return schwarzschildRadius(mass);
    default:
      return 0;
  }
}

/** Spin period at remnant age t (seconds), simple magnetic-dipole spin-down: P ∝ (1 + t/τ)^0.5 */
export function spinPeriodAt(remnant, tSeconds) {
  if (!remnant.spinPeriod0) return null;
  const tauS = remnant.spinDownYr * 3.15576e7;
  return remnant.spinPeriod0 * Math.sqrt(1 + Math.max(0, tSeconds) / tauS);
}

export const isNeutronStar = (r) => r && (r.type === 'neutron-star' || r.type === 'pulsar' || r.type === 'magnetar');

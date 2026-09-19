/**
 * Physical constants and model boundaries used across the simulation.
 * SI units unless the name says otherwise. Values labelled "MODEL" are
 * approximate thresholds chosen for this simulation, not measured constants.
 */

// --- Fundamental constants (CODATA 2018) ---
export const G = 6.674e-11; // m^3 kg^-1 s^-2
export const C = 2.99792458e8; // m/s
export const SIGMA_SB = 5.670374e-8; // W m^-2 K^-4
export const K_B = 1.380649e-23; // J/K
export const M_PROTON = 1.67262e-27; // kg

// --- Solar reference values (IAU 2015 nominal) ---
export const SOLAR_MASS_KG = 1.98847e30;
export const SOLAR_RADIUS_M = 6.957e8;
export const SOLAR_LUMINOSITY_W = 3.828e26;
export const SOLAR_TEFF_K = 5772;
export const SOLAR_METALLICITY = 0.0134; // mass fraction Z (Asplund 2009)
export const SUN_ABS_BOL_MAG = 4.74;

// --- Distances ---
export const AU_M = 1.495978707e11;
export const LIGHT_YEAR_M = 9.4607304725808e15;
export const PARSEC_M = 3.0856775814913673e16;
export const LY_PER_PC = 3.26156;

// --- Time ---
export const MINUTE_S = 60;
export const HOUR_S = 3600;
export const DAY_S = 86400;
export const YEAR_S = 3.15576e7; // Julian year

// --- Energy ---
export const ERG = 1e-7; // J
export const FOE = 1e44; // J  (1 "foe" = 1e51 erg, canonical supernova kinetic energy)

// --- Apparent magnitudes of reference objects (V band) ---
export const MAG_SUN = -26.74;
export const MAG_FULL_MOON = -12.74;
export const MAG_VENUS_MAX = -4.6;
export const MAG_SIRIUS = -1.46;
export const MAG_NAKED_EYE_LIMIT = 6.0;
export const MAG_DAYTIME_LIMIT = -4.0; // MODEL: objects brighter than this are noticeable in daylight

// --- Stellar physics thresholds (MODEL, approximate, metallicity dependent) ---
export const MIN_STAR_MASS = 0.08; // hydrogen-burning limit
export const MAX_STAR_MASS = 300;
export const HELIUM_WD_MASS_LIMIT = 0.5; // below: never ignites helium
export const MIN_CORE_COLLAPSE_MASS = 8; // above: iron core collapse
export const NS_BH_BOUNDARY_MASS = 20; // above (solar Z): black hole likely
export const WOLF_RAYET_MASS = 40; // above: envelope stripped before collapse
export const PISN_MIN_MASS = 140; // pair-instability window (low Z)
export const PISN_MAX_MASS = 260;
export const CHANDRASEKHAR_MASS = 1.4;
export const TOV_MASS_LIMIT = 2.2; // max neutron star mass

// --- Compact object sizes ---
export const NEUTRON_STAR_RADIUS_M = 12e3;
export const WHITE_DWARF_RADIUS_M = 7e6; // ~ Earth radius

// --- Interstellar medium (MODEL) ---
export const ISM_NUMBER_DENSITY = 1e6; // 1 particle per cm^3 -> per m^3
export const ISM_DENSITY = ISM_NUMBER_DENSITY * M_PROTON; // kg/m^3

// --- Planetary nebula (low-mass endpoint) ---
export const PN_EXPANSION_SPEED = 25e3; // m/s, typical planetary nebula expansion
export const PN_STAGE_DURATION_YR = 2e4; // visible lifetime of a planetary nebula

// --- Supernova model constants ---
export const NI56_HALF_LIFE_S = 6.077 * DAY_S;
export const CO56_HALF_LIFE_S = 77.27 * DAY_S;
export const NI56_DECAY_POWER = 3.9e10 * ERG * 1e3; // W per kg  (3.9e10 erg/s/g, Nadyozhin 1994)
export const CO56_DECAY_POWER = 6.8e9 * ERG * 1e3; // W per kg
export const NEUTRINO_BURST_ENERGY_J = 3e46; // ~3e53 erg, gravitational binding energy of a neutron star
export const NEUTRINO_BURST_TIMESCALE_S = 3;
export const INTERNAL_SHOCK_SPEED = 1.0e7; // m/s, shock speed inside the envelope (~10,000 km/s)

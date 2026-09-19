/**
 * Graphics quality presets. Particle counts are per ejecta system (two
 * systems), so "ultra" renders ~150k points — a trivial load for any
 * discrete GPU and the cap keeps integrated GPUs comfortable on "medium".
 */
export const QUALITY_PRESETS = {
  low: { label: 'Low', pixelRatio: 1, bloom: false, bloomScale: 0.5, particles: 5000, sphereSegments: 48, starfield: 2000, milkyWay: 1500 },
  medium: { label: 'Medium', pixelRatio: 1.25, bloom: true, bloomScale: 0.5, particles: 14000, sphereSegments: 96, starfield: 3500, milkyWay: 3000 },
  high: { label: 'High', pixelRatio: 1.5, bloom: true, bloomScale: 0.75, particles: 30000, sphereSegments: 128, starfield: 5000, milkyWay: 5000 },
  ultra: { label: 'Ultra', pixelRatio: 2, bloom: true, bloomScale: 1, particles: 75000, sphereSegments: 192, starfield: 7000, milkyWay: 8000 },
};

export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];
export const DEFAULT_QUALITY = 'medium';

import type { MaterialProps } from '../solver/types';

/**
 * Material library — standard SI engineering values.
 * E in MPa, fy in MPa, density in kg/m³.
 */
export const MATERIALS: MaterialProps[] = [
  { name: 'Structural Steel (A36)', E: 200_000, fy: 250, density: 7850 },
  { name: 'Structural Steel (A992)', E: 200_000, fy: 345, density: 7850 },
  { name: 'Aluminium 6061-T6', E: 68_900, fy: 276, density: 2700 },
  { name: 'Aluminium 7075-T6', E: 71_700, fy: 503, density: 2810 },
  { name: 'Concrete (25 MPa)', E: 25_000, fy: 25, density: 2400 },
  { name: 'Concrete (35 MPa)', E: 30_000, fy: 35, density: 2400 },
  { name: 'Timber (Douglas Fir)', E: 13_100, fy: 50, density: 540 },
  { name: 'Timber (Glulam)', E: 13_800, fy: 30, density: 530 },
  { name: 'Stainless Steel (304)', E: 193_000, fy: 215, density: 8000 },
  { name: 'Titanium Ti-6Al-4V', E: 113_800, fy: 880, density: 4430 },
];

export const DEFAULT_MATERIAL = MATERIALS[0];

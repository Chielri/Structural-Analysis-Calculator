import type { MaterialProps } from '../solver/types';

/**
 * Material library — standard SI engineering values.
 * E in MPa, fy in MPa, density in kg/m³.
 */
export const MATERIALS: MaterialProps[] = [
  { name: 'Structural Steel (A36)', E: 200_000, G: 77_000, fy: 250, fu: 400, density: 7850, isSteel: true },
  { name: 'Structural Steel (A992)', E: 200_000, G: 77_000, fy: 345, fu: 450, density: 7850, isSteel: true },
  { name: 'Structural Steel S275 (EN 10025-2)', E: 210_000, G: 81_000, fy: 275, fu: 410, density: 7850, isSteel: true },
  { name: 'Structural Steel S355 (EN 10025-2)', E: 210_000, G: 81_000, fy: 355, fu: 470, density: 7850, isSteel: true },
  { name: 'Aluminium 6061-T6', E: 68_900, fy: 276, density: 2700 },
  { name: 'Aluminium 7075-T6', E: 71_700, fy: 503, density: 2810 },
  { name: 'Concrete C25/30 (fck 25 MPa)', E: 31_000, fy: 25, density: 2400, isConcrete: true, fck: 25 },
  { name: 'Concrete C30/37 (fck 30 MPa)', E: 33_000, fy: 30, density: 2400, isConcrete: true, fck: 30 },
  { name: 'Concrete C32/40 (fck 32 MPa)', E: 33_300, fy: 32, density: 2400, isConcrete: true, fck: 32 },
  { name: 'Concrete C35/45 (fck 35 MPa)', E: 34_000, fy: 35, density: 2400, isConcrete: true, fck: 35 },
  { name: 'Concrete C40/50 (fck 40 MPa)', E: 35_000, fy: 40, density: 2400, isConcrete: true, fck: 40 },
  { name: 'Concrete C50/60 (fck 50 MPa)', E: 37_000, fy: 50, density: 2400, isConcrete: true, fck: 50 },
  { name: 'Timber (Douglas Fir)', E: 13_100, fy: 50, density: 540 },
  { name: 'Timber (Glulam)', E: 13_800, fy: 30, density: 530 },
  { name: 'Stainless Steel (304)', E: 193_000, fy: 215, density: 8000 },
  { name: 'Titanium Ti-6Al-4V', E: 113_800, fy: 880, density: 4430 },
];

export const DEFAULT_MATERIAL = MATERIALS[0];

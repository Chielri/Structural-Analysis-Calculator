/**
 * Unit system conversions.
 *
 * Internal storage is SI:
 *   - length:           m
 *   - force:            kN
 *   - distributed load: kN/m
 *   - moment:           kN·m
 *   - stress:           MPa
 *   - deflection:       mm (already converted)
 *   - E:                MPa
 *   - I:                m⁴
 */

export type UnitSystem = 'SI' | 'Imperial';

export interface UnitLabels {
  length: string;
  force: string;
  distLoad: string;
  moment: string;
  stress: string;
  deflection: string;
  E: string;
  I: string;
}

export const SI_LABELS: UnitLabels = {
  length: 'm',
  force: 'kN',
  distLoad: 'kN/m',
  moment: 'kN·m',
  stress: 'MPa',
  deflection: 'mm',
  E: 'MPa',
  I: 'm⁴',
};

export const IMPERIAL_LABELS: UnitLabels = {
  length: 'ft',
  force: 'kip',
  distLoad: 'kip/ft',
  moment: 'kip·ft',
  stress: 'ksi',
  deflection: 'in',
  E: 'ksi',
  I: 'in⁴',
};

export function labels(sys: UnitSystem): UnitLabels {
  return sys === 'SI' ? SI_LABELS : IMPERIAL_LABELS;
}

// === SI → display ===
const M_PER_FT = 0.3048;
const KN_PER_KIP = 4.4482216;
const MPA_PER_KSI = 6.89476;
const MM_PER_IN = 25.4;
const M4_PER_IN4 = Math.pow(0.0254, 4); // m⁴ per in⁴

export function fromSI_length(v_m: number, sys: UnitSystem): number {
  return sys === 'SI' ? v_m : v_m / M_PER_FT;
}
export function toSI_length(v: number, sys: UnitSystem): number {
  return sys === 'SI' ? v : v * M_PER_FT;
}

export function fromSI_force(v_kN: number, sys: UnitSystem): number {
  return sys === 'SI' ? v_kN : v_kN / KN_PER_KIP;
}
export function toSI_force(v: number, sys: UnitSystem): number {
  return sys === 'SI' ? v : v * KN_PER_KIP;
}

export function fromSI_distLoad(v_kNpm: number, sys: UnitSystem): number {
  return sys === 'SI' ? v_kNpm : v_kNpm / (KN_PER_KIP / M_PER_FT);
}
export function toSI_distLoad(v: number, sys: UnitSystem): number {
  return sys === 'SI' ? v : v * (KN_PER_KIP / M_PER_FT);
}

export function fromSI_moment(v_kNm: number, sys: UnitSystem): number {
  return sys === 'SI' ? v_kNm : v_kNm / (KN_PER_KIP * M_PER_FT);
}
export function toSI_moment(v: number, sys: UnitSystem): number {
  return sys === 'SI' ? v : v * (KN_PER_KIP * M_PER_FT);
}

export function fromSI_stress(v_MPa: number, sys: UnitSystem): number {
  return sys === 'SI' ? v_MPa : v_MPa / MPA_PER_KSI;
}
export function toSI_stress(v: number, sys: UnitSystem): number {
  return sys === 'SI' ? v : v * MPA_PER_KSI;
}

export function fromSI_deflection_mm(v_mm: number, sys: UnitSystem): number {
  return sys === 'SI' ? v_mm : v_mm / MM_PER_IN;
}
export function toSI_deflection_mm(v: number, sys: UnitSystem): number {
  return sys === 'SI' ? v : v * MM_PER_IN;
}

export function fromSI_E(v_MPa: number, sys: UnitSystem): number {
  return fromSI_stress(v_MPa, sys);
}
export function toSI_E(v: number, sys: UnitSystem): number {
  return toSI_stress(v, sys);
}

export function fromSI_I(v_m4: number, sys: UnitSystem): number {
  return sys === 'SI' ? v_m4 : v_m4 / M4_PER_IN4;
}
export function toSI_I(v: number, sys: UnitSystem): number {
  return sys === 'SI' ? v : v * M4_PER_IN4;
}

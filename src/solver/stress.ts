import type { BeamModel } from './types';

/**
 * Maximum bending stress in MPa.
 *
 *   σ = M_max * c / I
 *
 * Where:
 *   M_max in kN·m → convert to N·mm: ×10^6
 *   I    in m⁴  → mm⁴: ×10^12
 *   c    in m   → mm:  ×1000
 *   σ    in N/mm² = MPa
 */
export function bendingStress(M_kNm: number, I_m4: number, c_m: number): number {
  if (I_m4 <= 0) return 0;
  const M_Nmm = M_kNm * 1e6;
  const I_mm4 = I_m4 * 1e12;
  const c_mm = c_m * 1000;
  return (M_Nmm * c_mm) / I_mm4;
}

/**
 * Max shear stress, approximate based on shape factor.
 *
 *   τ_max = k · V / A
 *
 * Shape factors: rectangle 1.5, circle 4/3, I-beam ≈ 1 (using V/(d*tw)).
 * For non-standard shapes, fallback uses k=1 (τ = V/A).
 *
 * V in kN, A in m² → τ in kPa → convert to MPa (÷1000).
 */
export function shearStress(V_kN: number, model: BeamModel): number | undefined {
  const A_m2 = model.section.A;
  if (!A_m2 || A_m2 <= 0) return undefined;
  const shape = model.section.shape;
  let k = 1;
  if (shape === 'rectangle') k = 1.5;
  else if (shape === 'circle') k = 4 / 3;
  else if (shape === 'I' || shape === 'channel') {
    // For I-beam: τ_max ≈ V/(d * tw). Use that if d & b known
    const d = model.section.d;
    const b = model.section.b;
    if (d && b) {
      const tau_Pa = (V_kN * 1000) / (d * b); // N/m² (kN→N, m·m)
      return tau_Pa / 1e6;
    }
  }
  const tau_Pa = (k * V_kN * 1000) / A_m2;
  return tau_Pa / 1e6;
}

/**
 * Resolve the extreme fiber distance c for stress calc.
 * Prefers max(yTop, yBot); falls back to half of `d` if defined.
 */
export function extremeFiberC(model: BeamModel): number {
  const { yTop, yBot, d } = model.section;
  let c = 0;
  if (yTop !== undefined) c = Math.max(c, Math.abs(yTop));
  if (yBot !== undefined) c = Math.max(c, Math.abs(yBot));
  if (c === 0 && d !== undefined) c = d / 2;
  return c;
}

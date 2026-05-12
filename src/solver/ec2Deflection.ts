/**
 * EC2 (SS EN 1992-1-1:2008) Clause 7.4.3 — Direct total deflection check
 * for a rectangular RC section under a UDL-dominant simply-supported span,
 * with optional cantilever support-condition factor.
 *
 * Implements the corrected procedure from the project coding reference:
 *   - Step 1   Concrete material properties (fcm, fctm, Ecm)
 *   - Step 2   Long-term effective modulus and modular ratio
 *   - Step 3   Uncracked (State I) transformed section properties
 *   - Step 4   Cracked (State II) section properties with compression-steel check
 *   - Step 5   Cracking moment Mcr
 *   - Step 6   Distribution coefficient ζ (with uncracked short-circuit)
 *   - Step 7   Flexural curvature interpolation (Eq. 7.18)
 *   - Step 8   Shrinkage curvature (Eq. 7.21) + interpolation
 *   - Step 9   Total long-term deflection and L/250 check
 *   - Step 10  Instantaneous deflection and L/500 post-construction check
 *
 * All inputs/outputs are SI-derived: lengths in mm, stresses in MPa,
 * moments in N·mm, deflections in mm.
 */

import type {
  BeamModel,
  ConcreteDeflectionInput,
  EC2DeflectionResult,
  DiagramPoint,
} from './types';

interface SectionGeom {
  b: number;   // mm
  h: number;   // mm
  d: number;   // mm
  d_prime: number; // mm
  As: number;  // mm²
  As_prime: number; // mm²
}

interface StateProps {
  x: number;
  I: number;
}

function fctmFromFck(fck: number): number {
  if (fck <= 50) return 0.30 * Math.pow(fck, 2 / 3);
  const fcm = fck + 8;
  return 2.12 * Math.log(1 + fcm / 10);
}

function ecmFromFcm(fcm: number): number {
  // Returns MPa. EC2 Table 3.1: Ecm = 22·(fcm/10)^0.3 [GPa]
  return 22 * Math.pow(fcm / 10, 0.3) * 1000;
}

function stateI(g: SectionGeom, alpha_e: number): StateProps {
  const { b, h, d, d_prime, As, As_prime } = g;
  const num = b * h * (h / 2) + (alpha_e - 1) * As_prime * d_prime + alpha_e * As * d;
  const den = b * h + (alpha_e - 1) * As_prime + alpha_e * As;
  const x = num / den;
  const I_conc = (b * Math.pow(h, 3)) / 12 + b * h * Math.pow(h / 2 - x, 2);
  const I_sc = (alpha_e - 1) * As_prime * Math.pow(x - d_prime, 2);
  const I_st = alpha_e * As * Math.pow(d - x, 2);
  return { x, I: I_conc + I_sc + I_st };
}

function stateII(g: SectionGeom, alpha_e: number): StateProps & { reclassified: boolean } {
  let { As, As_prime } = g;
  const { b, d, d_prime } = g;
  let reclassified = false;

  const solveX = (As_t: number, As_c: number) => {
    const A = b / 2;
    const B = (alpha_e - 1) * As_c + alpha_e * As_t;
    const C = -((alpha_e - 1) * As_c * d_prime + alpha_e * As_t * d);
    const disc = B * B - 4 * A * C;
    return (-B + Math.sqrt(Math.max(0, disc))) / (2 * A);
  };

  let x = solveX(As, As_prime);
  if (As_prime > 0 && x <= d_prime) {
    // Compression steel sits at or below the cracked NA → it is in tension.
    // Reclassify (Step 4.3) by merging into As and recomputing.
    As += As_prime;
    As_prime = 0;
    x = solveX(As, As_prime);
    reclassified = true;
  }
  const I_conc = (b * Math.pow(x, 3)) / 3;
  const I_sc = (alpha_e - 1) * As_prime * Math.pow(x - d_prime, 2);
  const I_st = alpha_e * As * Math.pow(d - x, 2);
  return { x, I: I_conc + I_sc + I_st, reclassified };
}

function firstMomentOfRebar(
  g: SectionGeom,
  x: number,
  reclassified: boolean,
): number {
  // S about the section centroid (which lies at depth x from the compression face).
  // Sign convention matches Step 8: tension steel below centroid → positive contribution.
  const As_prime_eff = reclassified ? 0 : g.As_prime;
  const As_eff = reclassified ? g.As + g.As_prime : g.As;
  return As_eff * (g.d - x) - As_prime_eff * (x - g.d_prime);
}

/** Support-condition factor for converting κ·L² → δ. */
function supportFactors(
  model: BeamModel,
): { k_flex: number; k_shrink: number; condition: string } {
  // Heuristic: a single fixed support and no other supports → cantilever (UDL).
  const supports = model.supports;
  if (
    supports.length === 1 &&
    supports[0].type === 'fixed'
  ) {
    return { k_flex: 1 / 4, k_shrink: 1 / 2, condition: 'cantilever' };
  }
  // Default: simply supported, UDL.
  return { k_flex: 5 / 48, k_shrink: 1 / 8, condition: 'simply-supported' };
}

/**
 * Peak |bending moment| from the BMD, returned as a positive N·mm value.
 * The BMD comes from the existing solver in kN·m; multiply by 1e6 → N·mm.
 */
function peakMomentNmm(bmd: DiagramPoint[]): number {
  let peak = 0;
  for (const p of bmd) {
    const v = Math.abs(p.value);
    if (v > peak) peak = v;
  }
  return peak * 1e6;
}

export interface EC2DeflectionArgs {
  model: BeamModel;
  bmd: DiagramPoint[];          // kN·m
  L_eff_mm?: number;            // mm; defaults to model.length × 1000
}

export function computeEC2Deflection(
  args: EC2DeflectionArgs,
): EC2DeflectionResult | null {
  const { model, bmd } = args;
  const mat = model.material;
  const cfg: ConcreteDeflectionInput | undefined = model.concrete;
  if (!mat.isConcrete || !mat.fck || !cfg) return null;

  const fck = mat.fck;
  const Es = cfg.Es > 0 ? cfg.Es : 200_000;

  const fcm = fck + 8;
  const fctm = fctmFromFck(fck);
  const Ecm = ecmFromFcm(fcm); // MPa
  const Ec_eff = Ecm / (1 + Math.max(0, cfg.phi));
  const alpha_e = Es / Ec_eff;
  const alpha_e_inst = Es / Ecm;

  const b = model.section.b ? model.section.b * 1000 : 0;
  const h = model.section.d ? model.section.d * 1000 : 0;
  const warnings: string[] = [];
  if (!(b > 0 && h > 0)) {
    warnings.push(
      'EC2 deflection requires a rectangular section width (b) and depth (h). Use the Rectangle section input.',
    );
    return null;
  }
  if (!(cfg.d > 0) || cfg.d >= h) {
    warnings.push('Effective depth d must satisfy 0 < d < h.');
  }
  if (cfg.As_prime > 0 && (cfg.d_prime <= 0 || cfg.d_prime >= cfg.d)) {
    warnings.push("Compression-steel depth d' must satisfy 0 < d' < d.");
  }

  const g: SectionGeom = {
    b,
    h,
    d: cfg.d,
    d_prime: cfg.d_prime,
    As: cfg.As,
    As_prime: cfg.As_prime,
  };

  // Long-term properties (Steps 3–4)
  const s1 = stateI(g, alpha_e);
  const s2 = stateII(g, alpha_e);
  if (s2.reclassified) {
    warnings.push(
      "Compression reinforcement lies below the cracked neutral axis — reclassified as tension steel (Step 4.3).",
    );
  }
  if (s2.I >= s1.I) {
    warnings.push('Cracked I_II ≥ uncracked I_I — verify inputs.');
  }

  // Step 5 — cracking moment (sagging at mid-span: y_t = h − x_I)
  const y_t = h - s1.x;
  const Mcr = (fctm * s1.I) / y_t;

  // Step 6 — distribution coefficient
  const M_qp = peakMomentNmm(bmd);
  let zeta = 0;
  let cracked = false;
  if (M_qp > Mcr) {
    cracked = true;
    const z = 1 - cfg.beta * Math.pow(Mcr / M_qp, 2);
    zeta = Math.max(0, Math.min(1, z));
  }

  // Step 7 — flexural curvatures (1/mm). Ec_eff in MPa = N/mm², I in mm⁴, M in N·mm.
  const kappa_I = M_qp / (Ec_eff * s1.I);
  const kappa_II = M_qp / (Ec_eff * s2.I);
  const kappa_m = zeta * kappa_II + (1 - zeta) * kappa_I;

  // Step 8 — shrinkage curvatures
  const S_I = firstMomentOfRebar(g, s1.x, s2.reclassified);
  const S_II = firstMomentOfRebar(g, s2.x, s2.reclassified);
  const kappa_cs_I = (cfg.eps_cs * alpha_e * S_I) / s1.I;
  const kappa_cs_II = (cfg.eps_cs * alpha_e * S_II) / s2.I;
  const kappa_cs_m = zeta * kappa_cs_II + (1 - zeta) * kappa_cs_I;

  // Step 9 — total long-term deflection
  const L_eff = args.L_eff_mm ?? model.length * 1000;
  const { k_flex, k_shrink, condition } = supportFactors(model);
  if (condition !== 'simply-supported' && condition !== 'cantilever') {
    warnings.push(
      'Support condition not in {simply-supported UDL, cantilever UDL}; EC2 simplified factors may not apply.',
    );
  }
  const delta_flex = k_flex * kappa_m * L_eff * L_eff;
  const delta_shrink = k_shrink * kappa_cs_m * L_eff * L_eff;
  const delta_total = delta_flex + delta_shrink;

  const limit_L250 = L_eff / 250;
  const pass_L250 = delta_total <= limit_L250;

  // Step 10 — instantaneous deflection for L/500 post-construction check
  const instRatio = cfg.instMomentRatio ?? 1.0;
  const M_inst = M_qp * instRatio;
  const s1_inst = stateI(g, alpha_e_inst);
  const s2_inst = stateII(g, alpha_e_inst);
  const y_t_inst = h - s1_inst.x;
  const Mcr_inst = (fctm * s1_inst.I) / y_t_inst;
  let zeta_inst = 0;
  if (M_inst > Mcr_inst) {
    zeta_inst = Math.max(0, Math.min(1, 1 - 1.0 * Math.pow(Mcr_inst / M_inst, 2)));
  }
  const kappa_I_inst = M_inst / (Ecm * s1_inst.I);
  const kappa_II_inst = M_inst / (Ecm * s2_inst.I);
  const kappa_m_inst = zeta_inst * kappa_II_inst + (1 - zeta_inst) * kappa_I_inst;
  const delta_inst = k_flex * kappa_m_inst * L_eff * L_eff;
  const delta_post = delta_total - delta_inst;
  const limit_L500 = L_eff / 500;
  const pass_L500 = delta_post <= limit_L500;

  return {
    fcm,
    fctm,
    Ecm,
    Ec_eff,
    alpha_e,

    x_I: s1.x,
    I_I: s1.I,
    x_II: s2.x,
    I_II: s2.I,

    Mcr,
    M_qp,
    zeta,
    cracked,

    kappa_I,
    kappa_II,
    kappa_m,
    kappa_cs_I,
    kappa_cs_II,
    kappa_cs_m,

    delta_flex,
    delta_shrink,
    delta_total,

    L_eff,
    limit_L250,
    pass_L250,

    delta_inst,
    delta_post,
    limit_L500,
    pass_L500,

    k_flex,
    k_shrink,

    warnings,
  };
}

export const DEFAULT_CONCRETE_INPUT: ConcreteDeflectionInput = {
  As: 1500,
  As_prime: 0,
  d: 360,
  d_prime: 40,
  Es: 200_000,
  phi: 2.0,
  eps_cs: 0.0004,
  beta: 0.5,
  psi2: 0.3,
  instMomentRatio: 1.0,
};

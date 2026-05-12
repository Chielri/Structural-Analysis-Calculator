/**
 * EC2 (SS EN 1992-1-1) Cl. 6.1 — Flexural design of a rectangular RC
 * cross-section, singly or doubly reinforced. Returns the required tension
 * (and, if needed, compression) reinforcement areas so the user can compare
 * against `As` / `As'` provided to the deflection check.
 *
 * Uses the rectangular stress block (λ = 0.8, η = 1.0) — valid for fck ≤ 50 MPa.
 *
 * Inputs are SI-derived: lengths in mm, stresses in MPa, moments in N·mm.
 */

import type { BeamModel, ConcreteDesignInput, ConcreteDesignResult, DiagramPoint } from './types';

function peakMomentNmm(bmd: DiagramPoint[]): number {
  let peak = 0;
  for (const p of bmd) {
    const v = Math.abs(p.value);
    if (v > peak) peak = v;
  }
  return peak * 1e6; // kN·m → N·mm
}

function fctmFromFck(fck: number): number {
  if (fck <= 50) return 0.30 * Math.pow(fck, 2 / 3);
  const fcm = fck + 8;
  return 2.12 * Math.log(1 + fcm / 10);
}

export interface EC2DesignArgs {
  model: BeamModel;
  bmd: DiagramPoint[]; // kN·m
}

export function designConcreteFlexure(args: EC2DesignArgs): ConcreteDesignResult | null {
  const { model, bmd } = args;
  const mat = model.material;
  const cfg = model.concrete;
  const design = model.concreteDesign;
  if (!mat.isConcrete || !mat.fck || !cfg || !design) return null;

  const warnings: string[] = [];
  const fck = mat.fck;
  if (fck > 50) {
    warnings.push(
      'fck > 50 MPa — design uses the simplified λ = 0.8, η = 1.0 stress block which is valid only for fck ≤ 50 MPa.',
    );
  }

  const b = model.section.b ? model.section.b * 1000 : 0;
  const h = model.section.d ? model.section.d * 1000 : 0;
  if (!(b > 0 && h > 0)) {
    warnings.push('Rectangular section width (b) and depth (h) required.');
    return {
      M_Ed: 0,
      fcd: 0,
      fyd: 0,
      K: 0,
      K_lim: 0,
      z: 0,
      x_over_d_lim: 0,
      As_req: 0,
      As_prime_req: 0,
      As_min: 0,
      As_max: 0,
      doublyReinforced: false,
      compSteelYielding: true,
      feasible: false,
      utilization: 0,
      warnings,
    };
  }

  const d = cfg.d;
  const d_prime = cfg.d_prime;

  // ULS design moment.
  const M_peak_sls_Nmm = peakMomentNmm(bmd);
  const M_Ed =
    design.M_Ed && design.M_Ed > 0
      ? design.M_Ed
      : M_peak_sls_Nmm * Math.max(1, design.ulsFactor);

  const fyk = design.fyk;
  const gamma_c = Math.max(1.0, design.gamma_c);
  const gamma_s = Math.max(1.0, design.gamma_s);
  const alpha_cc = design.alpha_cc;
  const delta = Math.min(1.0, Math.max(0.7, design.delta));

  const fcd = (alpha_cc * fck) / gamma_c;
  const fyd = fyk / gamma_s;

  // Limiting neutral axis from redistribution (EC2 Cl. 5.5(4), fck ≤ 50):
  //   x/d ≤ (δ − k1) / k2, with k1 = 0.44, k2 = 1.25.
  const x_over_d_lim = Math.max(0, (delta - 0.44) / 1.25);

  // Rectangular stress block: M = (αcc·fck/γc)·b·(λ·x)·(d − λ·x/2).
  // Normalise by b·d²·fck → K(ξ) = c·λ·ξ·(1 − λ·ξ/2),
  // where c = αcc/γc, λ = 0.8, ξ = x/d.
  const cFac = alpha_cc / gamma_c;
  const lam = 0.8;

  const Kfun = (xi: number) => cFac * lam * xi * (1 - (lam * xi) / 2);
  const K_lim = Kfun(x_over_d_lim);

  const K = M_Ed / (b * d * d * fck);

  let z: number;
  let As_req: number;
  let As_prime_req = 0;
  let doublyReinforced = false;
  let compSteelYielding = true;
  let feasible = true;

  // Solve y = λ·ξ from K = c·y·(1 − y/2): y² − 2y + 2K/c = 0.
  const solveY = (Kval: number): number => {
    const disc = 1 - (2 * Kval) / cFac;
    if (disc < 0) return NaN;
    return 1 - Math.sqrt(disc);
  };

  if (K <= K_lim) {
    const y = solveY(K);
    if (!Number.isFinite(y)) {
      feasible = false;
      z = 0.95 * d;
    } else {
      z = Math.min(0.95 * d, d * (1 - y / 2));
    }
    As_req = M_Ed / (fyd * z);
  } else {
    doublyReinforced = true;
    // Limit moment carried by concrete alone.
    const y_lim = lam * x_over_d_lim;
    const z_lim = d * (1 - y_lim / 2);
    const M_lim = K_lim * b * d * d * fck;
    const dM = M_Ed - M_lim;

    // Check compression-steel strain reaches yield: εsc = εcu2 · (1 − d'/x_lim).
    const x_lim = x_over_d_lim * d;
    const eps_cu2 = 0.0035;
    const eps_sc = x_lim > 0 ? eps_cu2 * (1 - d_prime / x_lim) : 0;
    const eps_yd = fyd / 200_000;
    let fsc = fyd;
    if (eps_sc < eps_yd) {
      compSteelYielding = false;
      fsc = eps_sc * 200_000;
      if (fsc <= 0) {
        warnings.push(
          "Compression steel sits above the limit neutral axis — it cannot develop a useful stress. Increase section depth.",
        );
        feasible = false;
        fsc = 1; // avoid div-by-zero
      }
    }

    As_prime_req = dM / (fsc * (d - d_prime));
    As_req = M_lim / (fyd * z_lim) + (As_prime_req * fsc) / fyd;
    z = z_lim;

    if (K > 0.30) {
      warnings.push(
        'K > 0.30 — section is heavily over-reinforced; increase depth rather than adding more steel.',
      );
      feasible = false;
    }
  }

  // Minimum / maximum steel (Cl. 9.2.1.1).
  const fctm = fctmFromFck(fck);
  const As_min = Math.max((0.26 * fctm * b * d) / fyk, 0.0013 * b * d);
  const As_max = 0.04 * b * h;

  if (As_req < As_min) {
    warnings.push(
      `As_req = ${As_req.toFixed(0)} mm² is below As,min = ${As_min.toFixed(0)} mm² — As,min governs.`,
    );
    As_req = As_min;
  }
  if (As_req > As_max) {
    warnings.push(
      `As_req = ${As_req.toFixed(0)} mm² exceeds As,max = ${As_max.toFixed(0)} mm² — section is too small.`,
    );
    feasible = false;
  }

  // Utilization: required / provided.
  const provided = cfg.As > 0 ? cfg.As : 0;
  const utilization = provided > 0 ? As_req / provided : Number.POSITIVE_INFINITY;

  return {
    M_Ed,
    fcd,
    fyd,
    K,
    K_lim,
    z,
    x_over_d_lim,
    As_req,
    As_prime_req,
    As_min,
    As_max,
    doublyReinforced,
    compSteelYielding,
    feasible,
    utilization,
    warnings,
  };
}

export const DEFAULT_CONCRETE_DESIGN: ConcreteDesignInput = {
  ulsFactor: 1.4,
  fyk: 500,
  gamma_c: 1.5,
  gamma_s: 1.15,
  alpha_cc: 1.0,
  delta: 1.0,
};

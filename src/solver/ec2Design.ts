/**
 * EC2 (SS EN 1992-1-1:2008) + Singapore NA — Full beam design pipeline.
 *
 * Implements the build spec sections §1–§10:
 *   §1  Material (fcd, fyd, fctm, fctk_05, fctd, Ecm)
 *   §3  Effective depths
 *   §4  Bending: K vs K_lim from δ (SG NA k1=0.4)
 *   §5  Flexural steel — singly / doubly + As_min/As_max
 *   §6  Shear — variable strut, cot θ ∈ [1.0, 2.5]
 *   §7  Deflection — l/d (Tbl NA.5)
 *   §8  Crack control — Cl. 7.3.4 (SG NA kt = 1.0, k3 = 3.4, k4 = 0.425)
 *   §9  SLS stress limits — k1 = 0.6, k3 = 0.8 (SG NA)
 *   §10 Detailing — anchorage, lap, mandrel
 *
 * Units inside the engine: N, mm, MPa, N·mm. User-facing units (kN, kN·m)
 * are converted at boundaries.
 */

import type {
  BeamModel,
  ConcreteDesignInput,
  ConcreteDesignResult,
  DiagramPoint,
} from './types';

// =====================================================================
// Material helpers (Cl. 3.1, Table 3.1)
// =====================================================================

export function fctmFromFck(fck: number): number {
  if (fck <= 50) return 0.30 * Math.pow(fck, 2 / 3);
  return 2.12 * Math.log(1 + (fck + 8) / 10);
}

export function ecmFromFck(fck: number): number {
  // Ecm = 22 · ((fck+8)/10)^0.3 [GPa] → returns MPa.
  return 22 * Math.pow((fck + 8) / 10, 0.3) * 1000;
}

// =====================================================================
// Demand auto-pick from BMD/SFD (peak |value|, returned in user units)
// =====================================================================

function peakAbs(diagram: DiagramPoint[]): number {
  let peak = 0;
  for (const p of diagram) {
    const v = Math.abs(p.value);
    if (v > peak) peak = v;
  }
  return peak;
}

// =====================================================================
// Main entry
// =====================================================================

export interface EC2DesignArgs {
  model: BeamModel;
  bmd: DiagramPoint[]; // kN·m
  sfd: DiagramPoint[]; // kN
}

export function designConcreteBeam(args: EC2DesignArgs): ConcreteDesignResult | null {
  const { model, bmd, sfd } = args;
  const mat = model.material;
  const cfg = model.concreteDesign;
  const rebar = model.concrete;
  if (!mat.isConcrete || !mat.fck || !cfg) return null;

  const warnings: string[] = [];
  const fck = mat.fck;
  if (fck > 50) {
    warnings.push(
      'fck > 50 MPa — design uses the simplified stress block (λ = 0.8, η = 1.0) valid only for fck ≤ 50 MPa.',
    );
  }

  const b = model.section.b ? model.section.b * 1000 : 0;
  const h = model.section.d ? model.section.d * 1000 : 0;
  if (!(b > 0 && h > 0)) {
    warnings.push('Rectangular section width (b) and depth (h) required.');
    return emptyResult(cfg, warnings);
  }

  // ---------- §1 Material ----------
  const gamma_c = Math.max(1.0, cfg.gamma_c);
  const gamma_s = Math.max(1.0, cfg.gamma_s);
  const acc = cfg.alpha_cc;
  const act = cfg.alpha_ct;
  const fyk = cfg.fyk;

  const fcd = (acc * fck) / gamma_c;
  const fyd = fyk / gamma_s;
  const fctm = fctmFromFck(fck);
  const fctk_05 = 0.7 * fctm;
  const fctd = (act * fctk_05) / gamma_c;
  const Ecm = ecmFromFck(fck);
  const Es = rebar?.Es && rebar.Es > 0 ? rebar.Es : 200_000;

  // ---------- §3 Effective depths ----------
  const phi_bar = cfg.phi_bar;
  const phi_bar2 = cfg.phi_bar2 || phi_bar;
  const phi_link = cfg.phi_link;
  const cnom = cfg.cnom;

  // Derive d / d' from cover + bar geometry (§3 of the spec). The deflection
  // engine (ec2Deflection.ts) carries its own d in `model.concrete` for that
  // separate calc method; here we keep design self-consistent with the cover input.
  const d = h - cnom - phi_link - phi_bar / 2;
  const d_prime = cnom + phi_link + phi_bar2 / 2;
  if (d <= 0 || d >= h) {
    warnings.push('Computed d ≤ 0 or ≥ h — check cover and bar diameters.');
  }

  // ---------- §4 Bending ----------
  // Auto-pick M_Ed from peak |BMD| × ULS factor if not given.
  const M_Ed_kNm =
    cfg.M_Ed_kNm && cfg.M_Ed_kNm > 0
      ? cfg.M_Ed_kNm
      : peakAbs(bmd) * Math.max(1, cfg.ulsFactor);
  const M_Ed = M_Ed_kNm * 1e6; // → N·mm

  const delta = clamp(cfg.delta, 0.7, 1.0);
  // SG NA Cl. 5.5(4): k1 = 0.4, k2 = 0.6 + 0.0014/εcu2 = 1.0 for fck ≤ 50.
  const k1_redist = 0.4;
  const k2_redist = 1.0;
  const x_over_d_lim = Math.max(0, (delta - k1_redist) / k2_redist);
  // Klim from rectangular block at xu/d_max:
  //   K = 0.454·(x/d) − 0.182·(x/d)² (Mosley form).
  const K_lim = 0.454 * x_over_d_lim - 0.182 * x_over_d_lim * x_over_d_lim;

  const K = M_Ed / (b * d * d * fck);

  let z = 0;
  let As_req = 0;
  let As2_req = 0;
  let doublyReinforced = false;
  let compSteelYielding = true;
  let bendingFeasible = true;

  if (K <= K_lim) {
    // Singly reinforced (Mosley): z = d·(0.5 + √(0.25 − K/1.134)), capped at 0.95d.
    const disc = 0.25 - K / 1.134;
    if (disc < 0) {
      bendingFeasible = false;
      z = 0.95 * d;
    } else {
      z = Math.min(0.95 * d, d * (0.5 + Math.sqrt(disc)));
    }
    As_req = M_Ed / (fyd * z);
  } else {
    doublyReinforced = true;
    const zlim = d * (0.5 + Math.sqrt(Math.max(0, 0.25 - K_lim / 1.134)));
    const xu = (d - zlim) / 0.4; // since z = d − 0.4·xu
    const fsc_unbounded = xu > 0 ? 700 * (xu - d_prime) / xu : 0;
    const fsc = Math.min(Math.max(fsc_unbounded, 0), fyd);
    if (fsc < fyd) {
      compSteelYielding = false;
      if (fsc <= 0) {
        bendingFeasible = false;
        warnings.push(
          'Compression steel cannot develop stress (d′ ≥ xu) — increase section depth.',
        );
      }
    }
    const fsc_use = Math.max(fsc, 1); // div-by-zero guard
    As2_req = ((K - K_lim) * fck * b * d * d) / (fsc_use * (d - d_prime));
    As_req =
      (K_lim * fck * b * d * d) / (fyd * zlim) + (As2_req * fsc_use) / fyd;
    z = zlim;
    if (K > 0.30) {
      warnings.push(
        'K > 0.30 — section is heavily over-reinforced; increase depth rather than adding more steel.',
      );
      bendingFeasible = false;
    }
  }

  // ---------- §5.3 Min/max steel (Cl. 9.2.1.1) ----------
  const As_min = Math.max((0.26 * fctm * b * d) / fyk, 0.0013 * b * d);
  const As_max = 0.04 * b * h;
  if (As_req < As_min) {
    warnings.push(
      `As_req = ${As_req.toFixed(0)} mm² below As,min = ${As_min.toFixed(0)} mm² — As,min governs.`,
    );
    As_req = As_min;
  }
  if (As_req > As_max) {
    warnings.push(
      `As_req = ${As_req.toFixed(0)} mm² exceeds As,max = ${As_max.toFixed(0)} mm² — section too small.`,
    );
    bendingFeasible = false;
  }

  // ---------- §6 Shear (variable strut) ----------
  const V_Ed_kN =
    cfg.V_Ed_kN && cfg.V_Ed_kN > 0
      ? cfg.V_Ed_kN
      : peakAbs(sfd) * Math.max(1, cfg.ulsFactor);
  const V_Ed = V_Ed_kN * 1e3; // → N

  const z_sh = 0.9 * d;
  const nu1 = 0.6 * (1 - fck / 250); // Cl. 6.2.2(6); SG NA same
  const acw = 1.0;

  const VRd_max_fn = (cot: number) =>
    (acw * b * z_sh * nu1 * fcd) / (cot + 1 / cot);

  let cot_theta = NaN;
  let theta_deg = NaN;
  let shearFeasible = true;
  const VRd_25 = VRd_max_fn(2.5);

  if (V_Ed <= VRd_25) {
    cot_theta = 2.5;
    theta_deg = Math.atan(1 / 2.5) * (180 / Math.PI);
  } else {
    const sin_2th = (2 * V_Ed) / (acw * b * z_sh * nu1 * fcd);
    if (sin_2th > 1.0) {
      warnings.push(
        'Shear strut crushing: VEd > VRd,max(cotθ=1) — increase b, d, or fck.',
      );
      shearFeasible = false;
    } else {
      const th = 0.5 * Math.asin(sin_2th);
      cot_theta = 1 / Math.tan(th);
      theta_deg = th * (180 / Math.PI);
      if (cot_theta < 1.0) {
        warnings.push('cotθ < 1.0 outside SG NA range [1.0, 2.5] — section inadequate.');
        shearFeasible = false;
      }
    }
  }
  const VRd_max = Number.isFinite(cot_theta) ? VRd_max_fn(cot_theta) : VRd_25;

  // Asw / s — links area per mm
  let Asw_per_s_req = 0;
  if (Number.isFinite(cot_theta) && shearFeasible) {
    Asw_per_s_req = V_Ed / (z_sh * fyd * cot_theta);
  }
  // Min reinforcement: ρw,min = 0.08·√fck / fyk → Asw/s,min = ρw,min · b
  const rho_w_min = (0.08 * Math.sqrt(fck)) / fyk;
  const Asw_per_s_min = rho_w_min * b;
  Asw_per_s_req = Math.max(Asw_per_s_req, Asw_per_s_min);

  // Max spacing (SG NA Cl. 9.2.2)
  const sl_max = 0.75 * d;
  const st_max = Math.min(0.75 * d, 600);

  // Shift rule (Cl. 6.2.3(7))
  const dFtd_kN = Number.isFinite(cot_theta) ? 0.5 * V_Ed_kN * cot_theta : 0;

  // ---------- §7 Deflection l/d (Cl. 7.4.2 + Tbl NA.5) ----------
  const As_prov_factor = Math.max(1.0, cfg.As_prov_factor);
  const As_prov_used = As_req * As_prov_factor;
  const rho0 = 1e-3 * Math.sqrt(fck);
  const rho = As_req / (b * d);
  const rho2 = As2_req / (b * d);
  const K_sys = cfg.K_sys;
  const sqfck = Math.sqrt(fck);

  let ld_basic: number;
  if (rho <= rho0) {
    ld_basic =
      K_sys *
      (11 +
        (1.5 * sqfck * rho0) / Math.max(rho, 1e-12) +
        3.2 * sqfck * Math.pow(Math.max(rho0 / Math.max(rho, 1e-12) - 1, 0), 1.5));
  } else {
    ld_basic =
      K_sys *
      (11 +
        (1.5 * sqfck * rho0) / Math.max(rho - rho2, 1e-12) +
        (sqfck / 12) * Math.sqrt(Math.max(rho2, 0) / rho0));
  }
  // SG NA: stress modifier ≤ 1.5; abs cap 40·K_sys.
  const mod_stress = Math.min((500 * As_prov_used) / (fyk * As_req || 1), 1.5);
  const ld_allow = Math.min(ld_basic * mod_stress, 40 * K_sys);
  const ld_actual = (model.length * 1000) / d;
  const pass_ld = ld_actual <= ld_allow;

  // ---------- §8 Crack control (Cl. 7.3.4) ----------
  const M_qp_kNm =
    cfg.M_qp_kNm && cfg.M_qp_kNm > 0 ? cfg.M_qp_kNm : peakAbs(bmd);
  const M_qp = M_qp_kNm * 1e6; // N·mm

  const xc = 0.4 * d; // approx NA at service
  // Effective tension zone (Exp 7.10): hc,ef = min(2.5(h−d), (h−x)/3, h/2)
  const hc_ef = Math.min(2.5 * (h - d), (h - xc) / 3, h / 2);
  const Ac_eff = b * hc_ef;
  const rho_p_eff = As_prov_used / Math.max(Ac_eff, 1);
  const alpha_e = Es / Ecm;

  // Steel stress under quasi-permanent (approx z = 0.85d at SLS).
  const z_sls = 0.85 * d;
  const sigma_s_qp = M_qp / Math.max(As_prov_used * z_sls, 1);

  const kt = cfg.kt;
  const fct_eff = fctm;
  const stiffening = (kt * (fct_eff / Math.max(rho_p_eff, 1e-12)) * (1 + alpha_e * rho_p_eff));
  const eps_diff = Math.max(
    (sigma_s_qp - stiffening) / Es,
    (0.6 * sigma_s_qp) / Es,
  );

  // Max crack spacing (Exp 7.11): SG NA k3=3.4, k4=0.425; k1=0.8 (high-bond), k2=0.5 (bending).
  const k1c = 0.8;
  const k2c = 0.5;
  const k3c = 3.4;
  const k4c = 0.425;
  const sr_max =
    k3c * cnom + (k1c * k2c * k4c * phi_bar) / Math.max(rho_p_eff, 1e-12);
  const wk = sr_max * eps_diff;
  const pass_crack = wk <= cfg.wmax;

  // Min steel for crack control (Cl. 7.3.2, Exp 7.1)
  const kc_crack = 0.4; // pure bending, rect
  const k_crack = h <= 300 ? 1.0 : h >= 800 ? 0.65 : 1.0 - ((h - 300) / 500) * 0.35;
  const Act = b * (h - xc);
  const As_min_crack = (kc_crack * k_crack * fct_eff * Act) / fyk;

  // ---------- §9 SLS stress limits ----------
  const sigma_c_lim_char = 0.6 * fck;
  const sigma_s_lim_char = 0.8 * fyk;
  const sigma_s_lim_qp = 1.0 * fyk;

  // ---------- §10 Detailing ----------
  const dg = 20; // typical aggregate
  const s_clear_min = Math.max(phi_bar, dg + 5, 20);

  const eta1 = cfg.bond === 'good' ? 1.0 : 0.7;
  const eta2 = phi_bar <= 32 ? 1.0 : (132 - phi_bar) / 100;
  const fbd = 2.25 * eta1 * eta2 * fctd;
  const sigma_sd = fyd; // full anchorage
  const lb_rqd = (phi_bar / 4) * (sigma_sd / Math.max(fbd, 1e-6));
  // Design length (α1..α5 = 1.0 conservatively):
  const lb_min_tens = Math.max(0.3 * lb_rqd, 10 * phi_bar, 100);
  const lbd = Math.max(lb_rqd, lb_min_tens);
  // Lap (Cl. 8.7.3): α6 = √(ρ1/25), clamped [1, 1.5]
  const a6 = Math.max(1.0, Math.min(Math.sqrt(Math.max(cfg.rho1_pct, 0) / 25), 1.5));
  const l0_min = Math.max(0.3 * a6 * lb_rqd, 15 * phi_bar, 200);
  const l0 = Math.max(a6 * lb_rqd, l0_min);
  // Mandrel (SG NA Tbl NA.6a)
  const phi_mandrel_min = phi_bar <= 16 ? 4 * phi_bar : 7 * phi_bar;

  // ---------- Overall ----------
  const provided = rebar?.As && rebar.As > 0 ? rebar.As : 0;
  const utilization = provided > 0 ? As_req / provided : Number.POSITIVE_INFINITY;

  const feasible =
    bendingFeasible &&
    shearFeasible &&
    pass_ld &&
    pass_crack &&
    sigma_s_qp <= sigma_s_lim_qp;

  return {
    fcd,
    fyd,
    fctm,
    fctk_05,
    fctd,
    Ecm,
    Es,

    b,
    h,
    d,
    d_prime,

    M_Ed,
    K,
    K_lim,
    x_over_d_lim,
    z,
    As_req,
    As2_req,
    As_min,
    As_max,
    doublyReinforced,
    compSteelYielding,
    bendingFeasible,

    V_Ed,
    z_sh,
    nu1,
    cot_theta,
    theta_deg,
    VRd_max,
    Asw_per_s_req,
    Asw_per_s_min,
    sl_max,
    st_max,
    dFtd_kN,
    shearFeasible,

    rho0,
    rho,
    rho2,
    ld_basic,
    ld_allow,
    ld_actual,
    pass_ld,
    As_prov_used,

    M_qp,
    hc_ef,
    rho_p_eff,
    alpha_e,
    sigma_s_qp,
    eps_diff,
    sr_max,
    wk,
    wmax: cfg.wmax,
    pass_crack,
    As_min_crack,

    sigma_c_lim_char,
    sigma_s_lim_char,
    sigma_s_lim_qp,

    s_clear_min,
    fbd,
    lb_rqd,
    lbd,
    l0,
    phi_mandrel_min,

    feasible,
    utilization,
    warnings,
  };
}

// =====================================================================
// Helpers
// =====================================================================

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function emptyResult(cfg: ConcreteDesignInput, warnings: string[]): ConcreteDesignResult {
  return {
    fcd: 0, fyd: 0, fctm: 0, fctk_05: 0, fctd: 0, Ecm: 0, Es: 200_000,
    b: 0, h: 0, d: 0, d_prime: 0,
    M_Ed: 0, K: 0, K_lim: 0, x_over_d_lim: 0, z: 0,
    As_req: 0, As2_req: 0, As_min: 0, As_max: 0,
    doublyReinforced: false, compSteelYielding: true, bendingFeasible: false,
    V_Ed: 0, z_sh: 0, nu1: 0, cot_theta: NaN, theta_deg: NaN, VRd_max: 0,
    Asw_per_s_req: 0, Asw_per_s_min: 0, sl_max: 0, st_max: 0, dFtd_kN: 0,
    shearFeasible: false,
    rho0: 0, rho: 0, rho2: 0,
    ld_basic: 0, ld_allow: 0, ld_actual: 0, pass_ld: false, As_prov_used: 0,
    M_qp: 0, hc_ef: 0, rho_p_eff: 0, alpha_e: 0, sigma_s_qp: 0,
    eps_diff: 0, sr_max: 0, wk: 0, wmax: cfg.wmax, pass_crack: false,
    As_min_crack: 0,
    sigma_c_lim_char: 0, sigma_s_lim_char: 0, sigma_s_lim_qp: 0,
    s_clear_min: 0, fbd: 0, lb_rqd: 0, lbd: 0, l0: 0, phi_mandrel_min: 0,
    feasible: false, utilization: 0, warnings,
  };
}

// Back-compat alias for the original entry point.
export const designConcreteFlexure = designConcreteBeam;

// =====================================================================
// Defaults (SG NA flavoured)
// =====================================================================

export const DEFAULT_CONCRETE_DESIGN: ConcreteDesignInput = {
  ulsFactor: 1.4,

  fyk: 500,
  gamma_c: 1.5,
  gamma_s: 1.15,
  alpha_cc: 0.85,   // SG NA Cl. 3.1.6(1)P
  alpha_ct: 1.0,
  delta: 1.0,

  cnom: 35,
  phi_bar: 20,
  phi_bar2: 20,
  phi_link: 10,
  bond: 'good',

  K_sys: 1.0,
  As_prov_factor: 1.1,

  wmax: 0.3,
  kt: 1.0,          // SG NA Cl. 7.3.4(2)

  rho1_pct: 50,
};

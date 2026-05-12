/**
 * EC3 (SS EN 1993-1-1:2010) — I/H beam design pipeline.
 *
 * Implements:
 *   §5.5 / Table 5.2  — section classification (flange compression, web bending)
 *   §6.2.5            — Mc,Rd (class 1/2/3)
 *   §6.2.6            — Vpl,Rd, shear area, shear-buckling flag
 *   §6.2.8            — M-V interaction (eq 6.29 / 6.30)
 *   §6.3.2.3          — χLT for rolled / equiv welded I (eq 6.57)
 *   §6.3.2.2          — χLT, general (eq 6.56)
 *   §6.3.2.3(2)       — χLT,mod via f (eq 6.58)
 *   NCCI SN003        — Mcr (simplified 3-factor, kz=kw=1, zg=0)
 *
 * Units: N, mm, MPa, N·mm.
 */

import type {
  BeamModel,
  DiagramPoint,
  SteelDesignInput,
  SteelDesignResult,
  SteelISection,
} from './types';

// =====================================================================
// Geometry / classification helpers
// =====================================================================

export function epsilon(fy: number): number {
  return Math.sqrt(235 / fy);
}

/** Outstand flange flat: c = (b − tw − 2r) / 2  (Table 5.2 sht 2). */
export function flange_c(s: SteelISection): number {
  return (s.b - s.tw - 2 * s.r) / 2;
}

/** Internal web flat: c = h − 2tf − 2r  (Table 5.2 sht 1). */
export function web_c(s: SteelISection): number {
  return s.h - 2 * s.tf - 2 * s.r;
}

/** hw = h − 2tf  (§6.2.6 notation). */
export function hw(s: SteelISection): number {
  return s.h - 2 * s.tf;
}

export function classifyFlangeCompression(s: SteelISection, fy: number): 1 | 2 | 3 | 4 {
  const ct = flange_c(s) / s.tf;
  const e = epsilon(fy);
  if (ct <= 9 * e) return 1;
  if (ct <= 10 * e) return 2;
  if (ct <= 14 * e) return 3;
  return 4;
}

export function classifyWebBending(s: SteelISection, fy: number): 1 | 2 | 3 | 4 {
  const ct = web_c(s) / s.tw;
  const e = epsilon(fy);
  if (ct <= 72 * e) return 1;
  if (ct <= 83 * e) return 2;
  if (ct <= 124 * e) return 3;
  return 4;
}

// =====================================================================
// Resistances
// =====================================================================

export function Mc_Rd(s: SteelISection, fy: number, cls: number, gamma_M0: number): number {
  const W = cls <= 2 ? s.Wpl_y : s.Wel_y; // class 4 → Weff not handled here
  return (W * fy) / gamma_M0;
}

/** Shear area Av for rolled I/H, load parallel to web (§6.2.6(3)(a)). */
export function shearArea(s: SteelISection, eta: number): number {
  const Av_main = s.A - 2 * s.b * s.tf + (s.tw + 2 * s.r) * s.tf;
  const Av_min = eta * hw(s) * s.tw;
  return Math.max(Av_main, Av_min);
}

export function Vpl_Rd(Av: number, fy: number, gamma_M0: number): number {
  return (Av * (fy / Math.sqrt(3))) / gamma_M0;
}

/** ρ for M-V interaction (eq 6.29). 0 if VEd ≤ 0.5·Vpl. */
export function rhoShear(V_Ed: number, Vpl: number): number {
  if (Vpl <= 0 || V_Ed <= 0.5 * Vpl) return 0;
  return Math.pow((2 * V_Ed) / Vpl - 1, 2);
}

/** Reduced major-axis plastic M with shear (eq 6.30). Caps at Mc,Rd. */
export function MyV_Rd(
  s: SteelISection,
  fy: number,
  rho: number,
  gamma_M0: number,
  Mc: number,
): number {
  const Aw = hw(s) * s.tw;
  const W_eff = s.Wpl_y - (rho * Aw * Aw) / (4 * s.tw);
  return Math.min((W_eff * fy) / gamma_M0, Mc);
}

// =====================================================================
// LTB
// =====================================================================

const LTB_ALPHA: Record<'a' | 'b' | 'c' | 'd', number> = {
  a: 0.21,
  b: 0.34,
  c: 0.49,
  d: 0.76,
};

export function ltbCurveRolled(s: SteelISection): 'b' | 'c' {
  return s.h / s.b <= 2.0 ? 'b' : 'c';
}

export function ltbCurveWelded(s: SteelISection): 'c' | 'd' {
  return s.h / s.b <= 2.0 ? 'c' : 'd';
}

export function lambdaLTbar(Wy: number, fy: number, Mcr: number): number {
  if (Mcr <= 0) return Number.POSITIVE_INFINITY;
  return Math.sqrt((Wy * fy) / Mcr);
}

/** χLT, rolled / equiv welded I — eq 6.57. */
export function chiLTrolled(
  lam: number,
  curve: 'a' | 'b' | 'c' | 'd',
  lam0 = 0.4,
  beta = 0.75,
): number {
  if (lam <= lam0) return 1.0;
  const a = LTB_ALPHA[curve];
  const phi = 0.5 * (1 + a * (lam - lam0) + beta * lam * lam);
  const disc = phi * phi - beta * lam * lam;
  if (disc < 0) return 0;
  const chi = 1 / (phi + Math.sqrt(disc));
  return Math.min(chi, 1.0, 1 / (lam * lam));
}

/** χLT, general (any section) — eq 6.56. */
export function chiLTgeneral(lam: number, curve: 'a' | 'b' | 'c' | 'd'): number {
  if (lam <= 0.2) return 1.0;
  const a = LTB_ALPHA[curve];
  const phi = 0.5 * (1 + a * (lam - 0.2) + lam * lam);
  const disc = phi * phi - lam * lam;
  if (disc < 0) return 0;
  return Math.min(1 / (phi + Math.sqrt(disc)), 1.0);
}

/** f for χLT,mod (eq 6.58 footnote). */
export function fCorrection(lam: number, kc: number): number {
  const f = 1 - 0.5 * (1 - kc) * (1 - 2 * Math.pow(lam - 0.8, 2));
  return Math.min(f, 1.0);
}

/**
 * NCCI SN003 simplified Mcr — load at shear centre, kz=kw=1, zg=0.
 *   Mcr = C1 · (π²·E·Iz / L²) · √( Iw/Iz + L²·G·It/(π²·E·Iz) )
 */
export function McrSimple(
  s: SteelISection,
  L: number,
  E: number,
  G: number,
  C1: number,
): number {
  if (L <= 0) return Number.POSITIVE_INFINITY;
  const pi2EIz = Math.PI * Math.PI * E * s.Iz;
  const term1 = s.Iw / s.Iz;
  const term2 = (L * L * G * s.It) / pi2EIz;
  return C1 * (pi2EIz / (L * L)) * Math.sqrt(term1 + term2);
}

// =====================================================================
// Demand helpers
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

export interface EC3DesignArgs {
  model: BeamModel;
  bmd: DiagramPoint[]; // kN·m
  sfd: DiagramPoint[]; // kN
}

/** Reduce fy for thick flanges per EN 10025-2 Table 3.1 (S275/S355). */
function fyForThickness(fy_nom: number, tf: number): number {
  if (fy_nom === 275) {
    if (tf <= 16) return 275;
    if (tf <= 40) return 265;
    if (tf <= 63) return 255;
    return 245;
  }
  if (fy_nom === 355) {
    if (tf <= 16) return 355;
    if (tf <= 40) return 345;
    if (tf <= 63) return 335;
    return 325;
  }
  return fy_nom;
}

export function designSteelBeam(args: EC3DesignArgs): SteelDesignResult | null {
  const { model, bmd, sfd } = args;
  const mat = model.material;
  const sec = model.section.iSection;
  const cfg = model.steelDesign;
  if (!sec || !cfg) return null;
  if (mat.isConcrete) return null;
  if (!(mat.fy && mat.fy > 0)) return null;

  const warnings: string[] = [];
  const fy = fyForThickness(mat.fy, sec.tf);
  if (fy !== mat.fy) {
    warnings.push(
      `fy reduced to ${fy} MPa for tf = ${sec.tf} mm (EN 10025-2 Table 3.1).`,
    );
  }
  const E = mat.E; // MPa
  const G = mat.G && mat.G > 0 ? mat.G : 81_000;

  const gM0 = Math.max(0.5, cfg.gamma_M0);
  const gM1 = Math.max(0.5, cfg.gamma_M1);

  // ---------- Demands ----------
  const M_Ed_kNm =
    cfg.M_Ed_kNm && cfg.M_Ed_kNm > 0
      ? cfg.M_Ed_kNm
      : peakAbs(bmd) * Math.max(1, cfg.ulsFactor);
  const V_Ed_kN =
    cfg.V_Ed_kN && cfg.V_Ed_kN > 0
      ? cfg.V_Ed_kN
      : peakAbs(sfd) * Math.max(1, cfg.ulsFactor);
  const M_Ed = M_Ed_kNm * 1e6;
  const V_Ed = V_Ed_kN * 1e3;

  // ---------- Classification ----------
  const flangeClass = classifyFlangeCompression(sec, fy);
  const webClass = classifyWebBending(sec, fy);
  const sectionClass = Math.max(flangeClass, webClass) as 1 | 2 | 3 | 4;
  if (sectionClass === 4) {
    warnings.push(
      'Class 4 section — effective-width design (EN 1993-1-5) is not implemented; results approximate.',
    );
  }

  // ---------- Cross-section resistances ----------
  const McRd = Mc_Rd(sec, fy, sectionClass, gM0);
  const Av = shearArea(sec, cfg.eta_shear);
  const VplRd = Vpl_Rd(Av, fy, gM0);
  const shearBucklingFlag = hw(sec) / sec.tw > (72 * epsilon(fy)) / cfg.eta_shear;
  if (shearBucklingFlag) {
    warnings.push('hw/tw > 72ε/η — perform shear-buckling check per EN 1993-1-5 §5.');
  }

  // ---------- M-V interaction ----------
  const rho = rhoShear(V_Ed, VplRd);
  const MyVRd = rho > 0 ? MyV_Rd(sec, fy, rho, gM0, McRd) : McRd;

  // ---------- LTB ----------
  let ltbActive = false;
  let Mcr = Number.POSITIVE_INFINITY;
  let lam = 0;
  let curve: 'a' | 'b' | 'c' | 'd' = sec.welded
    ? ltbCurveWelded(sec)
    : ltbCurveRolled(sec);
  let chi = 1.0;
  let chi_mod = 1.0;
  let f = 1.0;
  let MbRd = sectionClass <= 2 ? (sec.Wpl_y * fy) / gM1 : (sec.Wel_y * fy) / gM1;

  if (cfg.ltbCheck && cfg.L_unrestrained_m > 0) {
    ltbActive = true;
    const L = cfg.L_unrestrained_m * 1000;
    Mcr = McrSimple(sec, L, E, G, cfg.C1);
    const Wy = sectionClass <= 2 ? sec.Wpl_y : sec.Wel_y;
    lam = lambdaLTbar(Wy, fy, Mcr);
    if (cfg.ltbMethod === 'rolled') {
      chi = chiLTrolled(lam, curve, cfg.lambdaLT0, cfg.beta_ltb);
    } else {
      chi = chiLTgeneral(lam, curve);
    }
    // χLT,mod via f
    if (cfg.kc < 1.0 && lam > 0.2) {
      f = fCorrection(lam, cfg.kc);
      chi_mod = Math.min(chi / f, 1.0, lam > 0 ? 1 / (lam * lam) : 1);
    } else {
      chi_mod = chi;
    }
    MbRd = (chi_mod * Wy * fy) / gM1;
  }

  // ---------- Utilization ----------
  const Mres = ltbActive ? Math.min(MbRd, MyVRd) : MyVRd;
  const utilM = Mres > 0 ? M_Ed / Mres : Number.POSITIVE_INFINITY;
  const utilV = VplRd > 0 ? V_Ed / VplRd : Number.POSITIVE_INFINITY;
  const pass_M = utilM <= 1.0;
  const pass_V = utilV <= 1.0;

  return {
    fy,
    E,
    G,
    epsilon: epsilon(fy),

    flangeClass,
    webClass,
    sectionClass,
    flange_c_over_t: flange_c(sec) / sec.tf,
    web_c_over_t: web_c(sec) / sec.tw,

    M_Ed,
    V_Ed,
    Mc_Rd: McRd,
    Av,
    Vpl_Rd: VplRd,
    shearBucklingFlag,

    rho_shear: rho,
    My_V_Rd: MyVRd,

    ltbActive,
    Mcr,
    lambda_LT: lam,
    ltbCurve: curve,
    chi_LT: chi,
    chi_LT_mod: chi_mod,
    f_correction: f,
    Mb_Rd: MbRd,

    utilM,
    utilV,
    pass_M,
    pass_V,
    // shearBucklingFlag means "an EN 1993-1-5 check is required" — not a
    // failure on its own. The web may still be adequate after that check;
    // we surface it as a warning and leave overall feasibility to the
    // M and V utilisation ratios.
    feasible: pass_M && pass_V,
    warnings,
  };
}

// =====================================================================
// Defaults
// =====================================================================

export const DEFAULT_STEEL_DESIGN: SteelDesignInput = {
  ulsFactor: 1.0, // assume user feeds factored loads
  gamma_M0: 1.0,
  gamma_M1: 1.0,
  gamma_M2: 1.25,

  ltbCheck: true,
  L_unrestrained_m: 0,    // 0 → user must enter; treated as no LTB until set
  C1: 1.13,               // SS-UDL (NCCI SN003)
  kc: 1.0,
  ltbMethod: 'rolled',
  lambdaLT0: 0.4,
  beta_ltb: 0.75,

  eta_shear: 1.0,
};

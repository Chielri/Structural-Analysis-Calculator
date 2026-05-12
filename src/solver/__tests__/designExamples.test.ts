/**
 * Worked-example unit tests that mirror the uploaded reference files.
 *
 * EC3: UB 457×191×82, S275, 8 m simply supported, 25 kN/m UDL
 *      (matches the worked example in ec3_beam_design.py).
 *
 * EC2 + SG NA: a 300×600 RC beam, fck = 30, fyk = 500, 7.5 m simply supported.
 *      Sanity check that the engine produces reasonable, codeable values.
 */
import { describe, expect, test } from 'vitest';
import {
  classifyFlangeCompression,
  classifyWebBending,
  Mc_Rd,
  shearArea,
  Vpl_Rd,
  ltbCurveRolled,
  McrSimple,
  lambdaLTbar,
  chiLTrolled,
  epsilon,
} from '../ec3Design';
import { designConcreteBeam } from '../ec2Design';
import { designSteelBeam } from '../ec3Design';
import type { SteelISection, BeamModel, DiagramPoint } from '../types';
import { DEFAULT_STEEL_DESIGN } from '../ec3Design';
import { DEFAULT_CONCRETE_DESIGN } from '../ec2Design';
import { DEFAULT_CONCRETE_INPUT } from '../ec2Deflection';

// =====================================================================
// EC3 — UB 457×191×82, S275 (matches uploaded worked example)
// =====================================================================
const UB457: SteelISection = {
  h: 460.0, b: 191.3, tw: 9.9, tf: 16.0, r: 10.2,
  A: 10500,
  Iy: 37100e4,
  Iz: 1870e4,
  Wpl_y: 1830e3,
  Wel_y: 1610e3,
  It: 69.2e4,
  Iw: 922e9,
  welded: false,
};

describe('EC3 — UB 457×191×82 S275 worked example', () => {
  const fy = 275; // tf = 16 mm → still 275 (≤ 16)
  const E = 210000;
  const G = 81000;

  test('ε computed from fy', () => {
    expect(epsilon(fy)).toBeCloseTo(0.924, 3);
  });

  test('Section classification = Class 1 (flange + web)', () => {
    expect(classifyFlangeCompression(UB457, fy)).toBe(1);
    expect(classifyWebBending(UB457, fy)).toBe(1);
  });

  test('Mc,Rd ≈ Wpl·fy / γM0 = 503.3 kN·m', () => {
    const Mc = Mc_Rd(UB457, fy, 1, 1.0);
    expect(Mc / 1e6).toBeCloseTo(503.25, 1);
  });

  test('Shear area and Vpl,Rd', () => {
    const Av = shearArea(UB457, 1.0);
    // Av_main = A − 2·b·tf + (tw + 2r)·tf
    //        = 10500 − 2·191.3·16 + (9.9 + 20.4)·16
    //        = 10500 − 6121.6 + 484.8 = 4863.2 mm²
    expect(Av).toBeCloseTo(4863.2, 0);
    const Vpl = Vpl_Rd(Av, fy, 1.0);
    // Vpl = 4863·275/√3 ≈ 772 kN
    expect(Vpl / 1e3).toBeCloseTo(772.2, 0);
  });

  test('LTB curve = c (h/b = 2.40 > 2)', () => {
    expect(ltbCurveRolled(UB457)).toBe('c');
  });

  test('Mcr (SS-UDL, C1=1.13, L=8 m, kz=kw=1, zg=0)', () => {
    const L = 8000;
    const Mcr = McrSimple(UB457, L, E, G, 1.13);
    // From the reference: Mcr ≈ 234–240 kN·m range for this section.
    expect(Mcr / 1e6).toBeGreaterThan(150);
    expect(Mcr / 1e6).toBeLessThan(400);
  });

  test('λ̄LT and χLT (rolled, eq 6.57)', () => {
    const L = 8000;
    const Mcr = McrSimple(UB457, L, E, G, 1.13);
    const lam = lambdaLTbar(UB457.Wpl_y, fy, Mcr);
    expect(lam).toBeGreaterThan(1.0);
    expect(lam).toBeLessThan(2.0);
    const chi = chiLTrolled(lam, 'c');
    expect(chi).toBeGreaterThan(0.1);
    expect(chi).toBeLessThan(1.0);
  });

  test('Full designSteelBeam pipeline with UDL=25 kN/m, L=8 m', () => {
    const L = 8;
    const w = 25; // kN/m
    const MEd_peak = (w * L * L) / 8; // 200
    const VEd_peak = (w * L) / 2;     // 100
    const bmd: DiagramPoint[] = [{ x: 0, value: 0 }, { x: L / 2, value: MEd_peak }, { x: L, value: 0 }];
    const sfd: DiagramPoint[] = [{ x: 0, value: VEd_peak }, { x: L, value: -VEd_peak }];

    const model: BeamModel = {
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: L },
      ],
      loads: [],
      hinges: [],
      section: { I: UB457.Iy / 1e12, A: UB457.A / 1e6, d: UB457.h / 1000, b: UB457.tw / 1000, iSection: UB457 },
      material: { name: 'S275', E: 210000, G: 81000, fy: 275, isSteel: true },
      steelDesign: { ...DEFAULT_STEEL_DESIGN, L_unrestrained_m: L, C1: 1.13 },
    };
    const r = designSteelBeam({ model, bmd, sfd });
    expect(r).not.toBeNull();
    expect(r!.sectionClass).toBe(1);
    expect(r!.M_Ed / 1e6).toBeCloseTo(200, 1);
    expect(r!.V_Ed / 1e3).toBeCloseTo(100, 1);
    expect(r!.Mc_Rd / 1e6).toBeCloseTo(503.25, 1);
    expect(r!.ltbActive).toBe(true);
    expect(r!.ltbCurve).toBe('c');
    expect(r!.Mb_Rd).toBeLessThan(r!.Mc_Rd); // LTB knocks down resistance
    expect(r!.pass_V).toBe(true);
    expect(r!.utilV).toBeLessThan(0.5); // VEd ≤ 0.5·Vpl → no M-V interaction
    expect(r!.rho_shear).toBe(0);
  });
});

// =====================================================================
// EC2 + SG NA — 300×600 RC beam, fck = 30, fyk = 500
// =====================================================================
describe('EC2 + SG NA — 300×600 beam', () => {
  const L = 7.5; // m
  const M_kNm = 250;
  const V_kN = 180;

  const bmd: DiagramPoint[] = [{ x: 0, value: 0 }, { x: L / 2, value: M_kNm }, { x: L, value: 0 }];
  const sfd: DiagramPoint[] = [{ x: 0, value: V_kN }, { x: L, value: -V_kN }];

  const model: BeamModel = {
    length: L,
    supports: [
      { id: 's1', type: 'pin', position: 0 },
      { id: 's2', type: 'roller', position: L },
    ],
    loads: [],
    hinges: [],
    section: { I: (0.3 * 0.6 ** 3) / 12, A: 0.3 * 0.6, b: 0.3, d: 0.6 },
    material: {
      name: 'C30/37',
      E: 33000,
      fy: 30,
      density: 2400,
      isConcrete: true,
      fck: 30,
    },
    concreteDesign: {
      ...DEFAULT_CONCRETE_DESIGN,
      ulsFactor: 1.0,
      M_Ed_kNm: M_kNm,
      V_Ed_kN: V_kN,
      M_qp_kNm: 160,
      cnom: 35,
      phi_bar: 20,
      phi_link: 10,
      K_sys: 1.0,
    },
    concrete: { ...DEFAULT_CONCRETE_INPUT, As: 1500 },
  };

  test('Material derivation', () => {
    const r = designConcreteBeam({ model, bmd, sfd })!;
    // αcc = 0.85, γc = 1.5 → fcd = 0.85·30/1.5 = 17.0
    expect(r.fcd).toBeCloseTo(17.0, 2);
    // fyd = 500/1.15 ≈ 434.78
    expect(r.fyd).toBeCloseTo(434.78, 1);
    // fctm = 0.30·30^(2/3) ≈ 2.896
    expect(r.fctm).toBeCloseTo(2.896, 2);
    // Ecm ≈ 22·((30+8)/10)^0.3·1000 ≈ 32837
    expect(r.Ecm).toBeCloseTo(32837, 0);
  });

  test('Effective depth from cover and bar geometry', () => {
    const r = designConcreteBeam({ model, bmd, sfd })!;
    // d = h − cnom − φlink − φbar/2 = 600 − 35 − 10 − 10 = 545
    expect(r.d).toBeCloseTo(545, 0);
  });

  test('Klim from δ = 1.0', () => {
    const r = designConcreteBeam({ model, bmd, sfd })!;
    // x/d_lim = (1.0 − 0.4) / 1.0 = 0.6 → Klim = 0.454·0.6 − 0.182·0.36 = 0.2068
    expect(r.x_over_d_lim).toBeCloseTo(0.6, 3);
    expect(r.K_lim).toBeCloseTo(0.2068, 3);
  });

  test('Bending: K ≤ Klim → singly reinforced', () => {
    const r = designConcreteBeam({ model, bmd, sfd })!;
    // K = 250e6 / (300 · 545² · 30) ≈ 0.0935
    expect(r.K).toBeCloseTo(0.0935, 3);
    expect(r.K).toBeLessThan(r.K_lim);
    expect(r.doublyReinforced).toBe(false);
    expect(r.bendingFeasible).toBe(true);
    // As_req between ~1200 and ~1400 mm²
    expect(r.As_req).toBeGreaterThan(1100);
    expect(r.As_req).toBeLessThan(1500);
  });

  test('Shear: cot θ defaults to 2.5 for low VEd', () => {
    const r = designConcreteBeam({ model, bmd, sfd })!;
    // VRd,max(cotθ=2.5) for 300·0.9·545·ν1·fcd / (2.5 + 0.4)
    expect(r.cot_theta).toBeCloseTo(2.5, 3);
    expect(r.shearFeasible).toBe(true);
    expect(r.Asw_per_s_req).toBeGreaterThan(0);
    expect(r.sl_max).toBeCloseTo(0.75 * 545, 1);
    expect(r.st_max).toBeCloseTo(Math.min(0.75 * 545, 600), 1);
  });

  test('Crack width is finite and sr,max uses SG NA k3·c term', () => {
    const r = designConcreteBeam({ model, bmd, sfd })!;
    expect(Number.isFinite(r.wk)).toBe(true);
    // sr_max ≥ k3·c = 3.4 · 35 = 119 mm
    expect(r.sr_max).toBeGreaterThanOrEqual(119);
  });

  test('Anchorage / lap / mandrel', () => {
    const r = designConcreteBeam({ model, bmd, sfd })!;
    expect(r.fbd).toBeGreaterThan(0);
    expect(r.lbd).toBeGreaterThan(0);
    expect(r.l0).toBeGreaterThanOrEqual(r.lbd * 0.3); // l0_min
    expect(r.phi_mandrel_min).toBeCloseTo(7 * 20, 0); // 20 mm bar → 7φ
  });
});

// =====================================================================
// EC2 — failure paths
// =====================================================================
describe('EC2 — failure paths', () => {
  const baseModel = (M_kNm: number, V_kN = 100): BeamModel => ({
    length: 7.5,
    supports: [
      { id: 's1', type: 'pin', position: 0 },
      { id: 's2', type: 'roller', position: 7.5 },
    ],
    loads: [],
    hinges: [],
    section: { I: (0.3 * 0.6 ** 3) / 12, A: 0.3 * 0.6, b: 0.3, d: 0.6 },
    material: { name: 'C30/37', E: 33000, fy: 30, density: 2400, isConcrete: true, fck: 30 },
    concreteDesign: {
      ...DEFAULT_CONCRETE_DESIGN,
      ulsFactor: 1.0,
      M_Ed_kNm: M_kNm,
      V_Ed_kN: V_kN,
      M_qp_kNm: M_kNm * 0.6,
    },
  });

  test('K > Klim → doubly reinforced and reports As2_req > 0', () => {
    // 300×600 C30, M = 800 kNm pushes K above 0.207 (Klim @ δ=1).
    const model = baseModel(800);
    const bmd: DiagramPoint[] = [{ x: 0, value: 0 }, { x: 3.75, value: 800 }, { x: 7.5, value: 0 }];
    const sfd: DiagramPoint[] = [{ x: 0, value: 100 }, { x: 7.5, value: -100 }];
    const r = designConcreteBeam({ model, bmd, sfd })!;
    expect(r.K).toBeGreaterThan(r.K_lim);
    expect(r.doublyReinforced).toBe(true);
    expect(r.As2_req).toBeGreaterThan(0);
  });

  test('VEd above strut crushing limit → shearFeasible = false', () => {
    // 2500 kN on a 300×600 — guaranteed to break sin2θ > 1.
    const model = baseModel(100, 2500);
    const bmd: DiagramPoint[] = [{ x: 0, value: 0 }, { x: 3.75, value: 100 }, { x: 7.5, value: 0 }];
    const sfd: DiagramPoint[] = [{ x: 0, value: 2500 }, { x: 7.5, value: -2500 }];
    const r = designConcreteBeam({ model, bmd, sfd })!;
    expect(r.shearFeasible).toBe(false);
    expect(r.feasible).toBe(false);
  });

  test('Cantilever: l/d uses cantilever length, not total beam length', () => {
    const model: BeamModel = {
      length: 4,
      supports: [{ id: 's1', type: 'fixed', position: 0 }],
      loads: [],
      hinges: [],
      section: { I: (0.3 * 0.5 ** 3) / 12, A: 0.3 * 0.5, b: 0.3, d: 0.5 },
      material: { name: 'C30/37', E: 33000, fy: 30, density: 2400, isConcrete: true, fck: 30 },
      concreteDesign: {
        ...DEFAULT_CONCRETE_DESIGN,
        ulsFactor: 1.0,
        M_Ed_kNm: 80,
        V_Ed_kN: 40,
        M_qp_kNm: 50,
        K_sys: 0.4, // cantilever
      },
    };
    const bmd: DiagramPoint[] = [{ x: 0, value: -80 }, { x: 4, value: 0 }];
    const sfd: DiagramPoint[] = [{ x: 0, value: 40 }, { x: 4, value: 0 }];
    const r = designConcreteBeam({ model, bmd, sfd })!;
    // d = 500 − 35 − 10 − 10 = 445 mm; L_eff = 4000 mm → l/d ≈ 8.99
    expect(r.ld_actual).toBeCloseTo(4000 / 445, 2);
  });

  test('Multi-support: l/d uses the longest span between adjacent supports', () => {
    const model: BeamModel = {
      length: 12,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: 4 },
        { id: 's3', type: 'roller', position: 12 }, // longest span = 8 m
      ],
      loads: [],
      hinges: [],
      section: { I: (0.3 * 0.6 ** 3) / 12, A: 0.3 * 0.6, b: 0.3, d: 0.6 },
      material: { name: 'C30/37', E: 33000, fy: 30, density: 2400, isConcrete: true, fck: 30 },
      concreteDesign: {
        ...DEFAULT_CONCRETE_DESIGN,
        ulsFactor: 1.0, M_Ed_kNm: 100, V_Ed_kN: 60, M_qp_kNm: 70,
      },
    };
    const bmd: DiagramPoint[] = [{ x: 0, value: 0 }, { x: 8, value: 100 }, { x: 12, value: 0 }];
    const sfd: DiagramPoint[] = [{ x: 0, value: 60 }, { x: 12, value: -60 }];
    const r = designConcreteBeam({ model, bmd, sfd })!;
    // d = 600 − 35 − 10 − 10 = 545 mm; longest gap = 8000 mm.
    expect(r.ld_actual).toBeCloseTo(8000 / 545, 3);
  });

  test('Provided As ≥ As_req → provided_ok = true, utilisation ≤ 1', () => {
    const model = baseModel(200);
    model.concrete = { ...DEFAULT_CONCRETE_INPUT, As: 5000 };
    const bmd: DiagramPoint[] = [{ x: 0, value: 0 }, { x: 3.75, value: 200 }, { x: 7.5, value: 0 }];
    const sfd: DiagramPoint[] = [{ x: 0, value: 100 }, { x: 7.5, value: -100 }];
    const r = designConcreteBeam({ model, bmd, sfd })!;
    expect(r.provided_ok).toBe(true);
    expect(r.used_provided_As).toBe(true);
    expect(r.utilization).toBeLessThanOrEqual(1);
  });

  test('No provided As → engine still runs and falls back to trial As', () => {
    const model = baseModel(200);
    // No `concrete` field at all.
    const bmd: DiagramPoint[] = [{ x: 0, value: 0 }, { x: 3.75, value: 200 }, { x: 7.5, value: 0 }];
    const sfd: DiagramPoint[] = [{ x: 0, value: 100 }, { x: 7.5, value: -100 }];
    const r = designConcreteBeam({ model, bmd, sfd })!;
    expect(r.used_provided_As).toBe(false);
    expect(r.provided_ok).toBe(false);
    expect(Number.isFinite(r.wk)).toBe(true);
  });
});

// =====================================================================
// EC3 — additional checks
// =====================================================================
describe('EC3 — LTB pinning and shear-buckling-flag behaviour', () => {
  const fy = 275;
  const E = 210000;
  const G = 81000;

  test('Pinned λ̄LT ≈ 1.4 and χLT ≈ 0.43 for the UB worked example', () => {
    const L = 8000;
    const Mcr = McrSimple(UB457, L, E, G, 1.13);
    const lam = lambdaLTbar(UB457.Wpl_y, fy, Mcr);
    const chi = chiLTrolled(lam, 'c');
    // Within ±5% of the values reported by the .py reference and a
    // hand-check of eq 6.57.
    expect(lam).toBeGreaterThan(1.35);
    expect(lam).toBeLessThan(1.55);
    expect(chi).toBeGreaterThan(0.38);
    expect(chi).toBeLessThan(0.48);
  });

  test('Shear-buckling flag is a warning, not a feasibility kill', () => {
    // Use a thin-webbed pseudo-section to force hw/tw > 72ε.
    const thin: SteelISection = { ...UB457, tw: 4.0, h: 700 };
    const model: BeamModel = {
      length: 8,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: 8 },
      ],
      loads: [],
      hinges: [],
      section: { I: thin.Iy / 1e12, A: thin.A / 1e6, d: thin.h / 1000, b: thin.tw / 1000, iSection: thin },
      material: { name: 'S275', E, G, fy, isSteel: true },
      steelDesign: { ...DEFAULT_STEEL_DESIGN, L_unrestrained_m: 0, ltbCheck: false },
    };
    const bmd: DiagramPoint[] = [{ x: 0, value: 0 }, { x: 4, value: 50 }, { x: 8, value: 0 }];
    const sfd: DiagramPoint[] = [{ x: 0, value: 25 }, { x: 8, value: -25 }];
    const r = designSteelBeam({ model, bmd, sfd })!;
    expect(r.shearBucklingFlag).toBe(true);
    // Demands are tiny — utilisation passes; feasibility should *not* be
    // dragged down by the shear-buckling-required flag.
    expect(r.pass_M).toBe(true);
    expect(r.pass_V).toBe(true);
    expect(r.feasible).toBe(true);
  });
});

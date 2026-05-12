import type { BeamModel, ReactionResult, DiagramPoint } from './types';
import { cumTrapz } from './utils';
import { momentAt } from './bendingMoment';

/**
 * Compute deflection curve by numerical double integration of M(x)/(EI).
 *
 *   EI * v''(x) = M(x)   (sagging positive ⇒ v positive upward)
 *
 * Steps:
 * 1. Sample M(x) on a uniform grid.
 * 2. Integrate once → slope = ∫ M/EI dx + C1.
 * 3. Integrate again → deflection v = ∫ slope dx + C2.
 * 4. Apply boundary conditions:
 *    - For each pin/roller/fixed support: v(x_support) = 0 (or settlement value).
 *    - For each fixed support: slope(x_support) = 0.
 *    - For each spring support: v = -F_spring / k (signed convention).
 * 5. Solve linear system for the integration constants and any extra unknowns.
 *
 * For simple cases (≥2 supports with v=0): solve C1, C2 from two v=0 conditions.
 * For a cantilever (1 fixed): apply slope=0 and v=0 at the fixed end.
 *
 * Returned deflection is in **mm** with **positive downward** convention
 * (engineering convention for display).
 */
export function buildDeflection(
  model: BeamModel,
  reactions: ReactionResult[],
  nSamples = 1000,
): { deflection: DiagramPoint[]; slope: DiagramPoint[] } {
  const L = model.length;
  const E_MPa = model.material.E; // MPa = N/mm²
  const I_m4 = model.section.I; // m⁴

  // EI in N·m² = (E in MPa = N/mm²) * (I in m⁴ = 10^12 mm⁴) * (1 mm²/m² conversion: 1 N/mm² = 10^6 N/m²)
  // Easier: EI [kN·m²] = E [MPa] * I [m⁴] * 1000
  //   E [MPa] = E * 1e6 [Pa = N/m²]
  //   EI [N·m²] = E*1e6 * I_m4
  //   EI [kN·m²] = E*1e3 * I_m4
  const EI = E_MPa * 1e3 * I_m4; // kN·m²

  if (EI <= 0) {
    const xs = uniformGrid(L, nSamples);
    return {
      deflection: xs.map((x) => ({ x, value: 0 })),
      slope: xs.map((x) => ({ x, value: 0 })),
    };
  }

  const xs = uniformGrid(L, nSamples);
  const M = xs.map((x) => ({ x, value: momentAt(model, reactions, x) })); // kN·m

  // M/EI : units (kN·m) / (kN·m²) = 1/m  (curvature)
  const curvature = M.map((p) => ({ x: p.x, value: p.value / EI }));

  // First integral: ∫ curvature dx + C1 → slope (rad)
  const slopeUnknownC = cumTrapz(curvature); // slope - C1
  // Second integral: ∫ (slopeUnknownC + C1) dx + C2 → v(x) (m)
  const slopeArr = slopeUnknownC.map((v, i) => ({ x: curvature[i].x, value: v }));
  const vNoConst = cumTrapz(slopeArr); // ∫ slopeUnknownC dx
  // v(x) = vNoConst(x) + C1 * x + C2

  // Boundary conditions: from supports.
  // For deflection convention here: v positive upward (consistent with EI*v''=M sagging+).
  // Settlement (if provided) is positive downward in input convention → v_BC = -settlement
  const bcs: { x: number; v?: number; slope?: number; springK?: number; reactionFy?: number }[] =
    [];
  for (const s of model.supports) {
    if (s.type === 'pin' || s.type === 'roller') {
      const settl = s.settlement ?? 0;
      bcs.push({ x: s.position, v: -settl });
    } else if (s.type === 'fixed') {
      const settl = s.settlement ?? 0;
      bcs.push({ x: s.position, v: -settl, slope: 0 });
    } else if (s.type === 'spring') {
      // v = -F / k, where F is reaction force (upward +).
      // Here F is in kN, k in kN/m → v in m.
      const rxn = reactions.find((r) => r.supportId === s.id);
      const F = rxn?.Fy ?? 0;
      const k = s.springStiffness ?? 0;
      const vBC = k > 0 ? -F / k : 0;
      bcs.push({ x: s.position, v: vBC });
    }
  }

  // We have unknowns: C1 (slope constant), C2 (deflection constant).
  // Each v BC gives one equation: vNoConst(x_BC) + C1*x_BC + C2 = v_BC
  // Each slope BC gives: slopeUnknownC(x_BC) + C1 = slope_BC
  // Find C1, C2 via least-squares if more than 2 BCs, or direct if exactly 2.
  const rows: number[][] = [];
  const rhs: number[] = [];
  for (const bc of bcs) {
    const idx = findClosestIndex(xs, bc.x);
    if (bc.v !== undefined) {
      rows.push([bc.x, 1]);
      rhs.push(bc.v - vNoConst[idx]);
    }
    if (bc.slope !== undefined) {
      rows.push([1, 0]);
      rhs.push(bc.slope - slopeUnknownC[idx]);
    }
  }

  let C1 = 0;
  let C2 = 0;
  if (rows.length >= 2) {
    // Solve normal equations: AᵀA · [C1, C2]ᵀ = Aᵀ b
    const [n11, n12, n22] = [0, 0, 0].map((_, k) => {
      let s = 0;
      for (const r of rows) {
        const a = k === 0 ? r[0] * r[0] : k === 1 ? r[0] * r[1] : r[1] * r[1];
        s += a;
      }
      return s;
    });
    let r1 = 0;
    let r2 = 0;
    for (let i = 0; i < rows.length; i++) {
      r1 += rows[i][0] * rhs[i];
      r2 += rows[i][1] * rhs[i];
    }
    const det = n11 * n22 - n12 * n12;
    if (Math.abs(det) > 1e-12) {
      C1 = (n22 * r1 - n12 * r2) / det;
      C2 = (n11 * r2 - n12 * r1) / det;
    }
  } else if (rows.length === 1) {
    // Only one BC — assume slope=0 at that point if not specified
    C2 = rhs[0] - rows[0][0] * C1;
  }

  // Final deflection and slope arrays
  // v in meters (positive upward in solver) → convert to mm and flip sign for "positive down" display
  const deflection: DiagramPoint[] = xs.map((x, i) => ({
    x,
    value: -(vNoConst[i] + C1 * x + C2) * 1000, // m → mm, sign flipped for "positive downward" display
  }));
  const slope: DiagramPoint[] = xs.map((x, i) => ({
    x,
    value: slopeUnknownC[i] + C1,
  }));
  return { deflection, slope };
}

function uniformGrid(L: number, n: number): number[] {
  const out = new Array(n + 1);
  for (let i = 0; i <= n; i++) out[i] = (i * L) / n;
  return out;
}

function findClosestIndex(xs: number[], target: number): number {
  let lo = 0,
    hi = xs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  // pick closer of lo, lo-1
  if (lo > 0 && Math.abs(xs[lo - 1] - target) < Math.abs(xs[lo] - target)) return lo - 1;
  return lo;
}

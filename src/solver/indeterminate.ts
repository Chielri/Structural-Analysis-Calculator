import type { BeamModel, Load, ReactionResult } from './types';
import { expandLoads, isDistributed, isMoment, isPoint, pointVerticalMag } from './utils';
import { gaussSolve } from './reactions';

/**
 * Direct Stiffness Method solver for beams (transverse displacements only).
 *
 * Conventions (LOCAL & GLOBAL — same since the beam is 1D):
 *  - v positive = upward (m)
 *  - θ positive = CCW (rad)
 *  - Forces F positive = upward (kN)
 *  - Moments M positive = CCW (kN·m)  — note: opposite of the rest of the codebase which uses CW+
 *
 * External LOADS in `BeamModel` use:
 *  - downward positive for forces (kN)
 *  - clockwise positive for applied moments (kN·m)
 *
 * Conversion happens inside the FEF code.
 *
 * Procedure:
 * 1. Build node list = supports ∪ hinges ∪ load points ∪ {0, L}.
 * 2. Number DOFs per node = (1 v) + (1 θ per "side" if hinge, else 1 θ).
 *    A non-hinge node owns one θ shared by adjacent elements.
 *    A hinge node has two θ DOFs (left side, right side).
 * 3. Assemble K and F vectors.
 * 4. Apply boundary conditions:
 *    - pin / roller: v = 0
 *    - fixed: v = 0, θ = 0
 *    - spring: add k to K[v_dof, v_dof]
 *    - settlement: v = settlement
 * 5. Solve reduced system.
 * 6. Recover reactions: R = K * d - F at constrained DOFs.
 *
 * Returns reactions (with our standard CW-positive Mz convention).
 */
export function solveStiffness(model: BeamModel): ReactionResult[] {
  const L = model.length;
  const E_MPa = model.material.E;
  const I_m4 = model.section.I;
  const EI = E_MPa * 1e3 * I_m4; // kN·m²

  if (EI <= 0) {
    throw new Error('Section EI must be positive');
  }

  const loads = expandLoads(model);

  // === Build node positions ===
  const nodeSet = new Set<number>();
  nodeSet.add(0);
  nodeSet.add(L);
  for (const s of model.supports) nodeSet.add(s.position);
  for (const h of model.hinges) nodeSet.add(h.position);
  for (const ld of loads) {
    if (ld.kind === 'point' || ld.kind === 'moment') nodeSet.add(ld.position);
    if (ld.kind === 'distributed') {
      nodeSet.add(ld.startPos);
      nodeSet.add(ld.endPos);
    }
  }
  const nodes = Array.from(nodeSet)
    .filter((x) => x >= -1e-9 && x <= L + 1e-9)
    .sort((a, b) => a - b);

  // Identify hinge nodes
  const hingeNodeIdx = new Set<number>();
  for (const h of model.hinges) {
    const idx = nodes.findIndex((x) => Math.abs(x - h.position) < 1e-9);
    if (idx > 0 && idx < nodes.length - 1) hingeNodeIdx.add(idx);
  }

  // DOF indexing
  // For each node: v_dof, then θ_dof. For hinge node: v_dof, θ_left_dof, θ_right_dof.
  type DOFMap = { v: number; thetaLeft: number; thetaRight: number };
  const dofMap: DOFMap[] = [];
  let dofCount = 0;
  for (let i = 0; i < nodes.length; i++) {
    const v = dofCount++;
    if (hingeNodeIdx.has(i)) {
      const tL = dofCount++;
      const tR = dofCount++;
      dofMap.push({ v, thetaLeft: tL, thetaRight: tR });
    } else {
      const t = dofCount++;
      dofMap.push({ v, thetaLeft: t, thetaRight: t });
    }
  }
  const nDof = dofCount;

  // === Assemble global K and F ===
  const K: number[][] = Array.from({ length: nDof }, () => new Array(nDof).fill(0));
  const F: number[] = new Array(nDof).fill(0);

  for (let e = 0; e < nodes.length - 1; e++) {
    const x_i = nodes[e];
    const x_j = nodes[e + 1];
    const Le = x_j - x_i;
    if (Le <= 0) continue;
    const ke = elementStiffness(EI, Le);
    const fe = elementFEF(loads, x_i, x_j, Le);

    // DOF indices for this element: [v_i, θ_i_right, v_j, θ_j_left]
    const di = dofMap[e];
    const dj = dofMap[e + 1];
    const idx = [di.v, di.thetaRight, dj.v, dj.thetaLeft];

    for (let a = 0; a < 4; a++) {
      F[idx[a]] += fe[a];
      for (let b = 0; b < 4; b++) {
        K[idx[a]][idx[b]] += ke[a][b];
      }
    }
  }

  // === Add nodal point loads and applied moments directly ===
  // Since we placed a node at every point-load/moment position, these loads are exactly at nodes
  // and contribute to the global F vector directly. elementFEF skips loads at element endpoints
  // to avoid double-counting.
  for (const ld of loads) {
    if (isPoint(ld)) {
      const idx = nodes.findIndex((x) => Math.abs(x - ld.position) < 1e-9);
      if (idx >= 0) {
        const Pval = pointVerticalMag(ld); // downward+
        // Equivalent nodal load = -P (in upward+ convention)
        // For a hinge node, force applies to shared v DOF (only one v).
        F[dofMap[idx].v] += -Pval;
      }
    } else if (isMoment(ld)) {
      const idx = nodes.findIndex((x) => Math.abs(x - ld.position) < 1e-9);
      if (idx >= 0) {
        // CW applied moment → -M_cw in CCW convention.
        // At a hinge node we have two θ DOFs; split the moment between them (acts on both sides).
        // For consistency with classical hinge behavior, apply the moment to one side (e.g., right).
        const dm = dofMap[idx];
        if (dm.thetaLeft === dm.thetaRight) {
          F[dm.thetaLeft] += -ld.magnitude;
        } else {
          // Distribute half each (this matters mainly at user-placed hinges; an applied moment at a
          // hinge is unusual but we handle it gracefully).
          F[dm.thetaLeft] += -ld.magnitude / 2;
          F[dm.thetaRight] += -ld.magnitude / 2;
        }
      }
    }
  }

  // === Apply boundary conditions ===
  // For each support, decide which DOFs are constrained and to what value.
  // Springs add stiffness to v DOF.
  type BC = { dof: number; value: number };
  const bcs: BC[] = [];

  for (const s of model.supports) {
    const idx = nodes.findIndex((x) => Math.abs(x - s.position) < 1e-9);
    if (idx < 0) continue;
    const d = dofMap[idx];
    const settl = s.settlement ?? 0;
    if (s.type === 'pin' || s.type === 'roller') {
      bcs.push({ dof: d.v, value: -settl }); // positive settlement = downward = v negative
    } else if (s.type === 'fixed') {
      bcs.push({ dof: d.v, value: -settl });
      // Fixed support locks rotation. If hinge node, both sides.
      bcs.push({ dof: d.thetaLeft, value: 0 });
      if (d.thetaLeft !== d.thetaRight) bcs.push({ dof: d.thetaRight, value: 0 });
    } else if (s.type === 'spring') {
      const k = s.springStiffness ?? 0;
      K[d.v][d.v] += k;
    }
  }

  // Penalty method: assign very large stiffness to constrained DOFs and set force = K_big * value.
  // Better: reduce the system. We'll reduce.
  const constrained = new Map<number, number>();
  for (const bc of bcs) constrained.set(bc.dof, bc.value);

  const free: number[] = [];
  for (let i = 0; i < nDof; i++) {
    if (!constrained.has(i)) free.push(i);
  }

  // F_eff for free DOFs: F_free - K[free, constrained] * d_constrained
  const F_eff = free.map((i) => {
    let v = F[i];
    for (const [c, val] of constrained) v -= K[i][c] * val;
    return v;
  });

  const K_ff: number[][] = free.map((i) => free.map((j) => K[i][j]));
  let d_free: number[];
  try {
    d_free = gaussSolve(K_ff, F_eff);
  } catch (e) {
    throw new Error(`Stiffness method failed: ${(e as Error).message}. Beam may be unstable.`);
  }

  // Build full displacement vector
  const d = new Array(nDof).fill(0);
  for (const [c, val] of constrained) d[c] = val;
  for (let i = 0; i < free.length; i++) d[free[i]] = d_free[i];

  // === Compute reactions ===
  // Reaction at constrained DOF: R = K[dof] · d - F[dof]
  const reactions: ReactionResult[] = [];
  for (const s of model.supports) {
    const idx = nodes.findIndex((x) => Math.abs(x - s.position) < 1e-9);
    if (idx < 0) continue;
    const dmap = dofMap[idx];
    const rxn: ReactionResult = { supportId: s.id, position: s.position, Fy: 0 };

    if (s.type === 'pin' || s.type === 'roller' || s.type === 'fixed') {
      let rv = -F[dmap.v];
      for (let j = 0; j < nDof; j++) rv += K[dmap.v][j] * d[j];
      rxn.Fy = rv;
    } else if (s.type === 'spring') {
      const k = s.springStiffness ?? 0;
      // Spring reaction = k * v_displacement (acts opposite to deflection)
      // v positive up; settlement positive downward → if beam moves down, v<0, spring pushes up: F = -k*v
      rxn.Fy = -k * d[dmap.v];
    }

    if (s.type === 'fixed') {
      let rm = -F[dmap.thetaLeft];
      for (let j = 0; j < nDof; j++) rm += K[dmap.thetaLeft][j] * d[j];
      // rm is CCW positive. Convert to CW positive for our convention.
      rxn.Mz = -rm;
    }

    if (s.type === 'pin' || s.type === 'fixed') {
      // Horizontal reaction. Sum all horizontal load components.
      let Fx = 0;
      for (const ld of loads) {
        if (ld.kind === 'point' && ld.angle) {
          Fx -= ld.magnitude * Math.sin((ld.angle * Math.PI) / 180);
        }
      }
      // If multiple pins/fixed, share equally? For simplicity assume only one provides Fx
      const horizontalSupports = model.supports.filter(
        (ss) => ss.type === 'pin' || ss.type === 'fixed',
      );
      if (horizontalSupports.length > 0) rxn.Fx = Fx / horizontalSupports.length;
    }

    reactions.push(rxn);
  }

  return reactions.sort((a, b) => a.position - b.position);
}

/** 4×4 Bernoulli-Euler beam element stiffness (transverse + rotation DOFs). */
export function elementStiffness(EI: number, L: number): number[][] {
  const L2 = L * L;
  const L3 = L2 * L;
  const a = EI / L3;
  return [
    [12 * a, 6 * L * a, -12 * a, 6 * L * a],
    [6 * L * a, 4 * L2 * a, -6 * L * a, 2 * L2 * a],
    [-12 * a, -6 * L * a, 12 * a, -6 * L * a],
    [6 * L * a, 2 * L2 * a, -6 * L * a, 4 * L2 * a],
  ];
}

/**
 * Equivalent nodal force vector for an element [x_i, x_j] of length Le,
 * accounting for distributed loads, point loads, and applied moments
 * whose support lies within this element.
 *
 * Output: [F_i_up, M_i_ccw, F_j_up, M_j_ccw]
 *
 * Convention: model loads are downward+ for forces and CW+ for moments.
 * We convert to the upward+/CCW+ convention used in the stiffness assembly.
 */
export function elementFEF(loads: Load[], x_i: number, x_j: number, Le: number): number[] {
  const fe = [0, 0, 0, 0];

  for (const ld of loads) {
    if (isDistributed(ld)) {
      // Overlap of this element with the load's range
      const a0 = Math.max(ld.startPos, x_i);
      const b0 = Math.min(ld.endPos, x_j);
      if (b0 - a0 <= 0) continue;

      // Linear interpolate intensity at endpoints of overlap
      const span = ld.endPos - ld.startPos;
      const wA = ld.startMag + ((a0 - ld.startPos) / span) * (ld.endMag - ld.startMag);
      const wB = ld.startMag + ((b0 - ld.startPos) / span) * (ld.endMag - ld.startMag);

      // Convert to "linear load" over the element with intensity wA at local a0' = a0 - x_i,
      // wB at b0' = b0 - x_i. For full coverage of element with linear load, use formulas;
      // for partial coverage, decompose: superpose two triangular loads and a constant.
      // Simplest: integrate numerically via Simpson's rule over the overlap to get FEF.
      addPartialLinearLoadFEF(fe, Le, a0 - x_i, b0 - x_i, wA, wB);
    } else if (isPoint(ld)) {
      // Only apply if STRICTLY inside the element. Nodal loads handled outside.
      const a = ld.position - x_i;
      if (a > 1e-9 && a < Le - 1e-9) {
        const b = Le - a;
        const Pval = pointVerticalMag(ld); // downward+
        const F_i = (Pval * b * b * (Le + 2 * a)) / (Le * Le * Le);
        const M_i = (Pval * a * b * b) / (Le * Le);
        const F_j = (Pval * a * a * (Le + 2 * b)) / (Le * Le * Le);
        const M_j = -(Pval * a * a * b) / (Le * Le);
        fe[0] += -F_i;
        fe[1] += -M_i;
        fe[2] += -F_j;
        fe[3] += -M_j;
      }
    } else if (isMoment(ld)) {
      const a = ld.position - x_i;
      if (a > 1e-9 && a < Le - 1e-9) {
        const b = Le - a;
        const M0_ccw = -ld.magnitude;
        const F_i = (-6 * M0_ccw * a * b) / (Le * Le * Le);
        const M_i = (M0_ccw * b * (2 * a - b)) / (Le * Le);
        const F_j = (6 * M0_ccw * a * b) / (Le * Le * Le);
        const M_j = (M0_ccw * a * (2 * b - a)) / (Le * Le);
        fe[0] += -F_i;
        fe[1] += -M_i;
        fe[2] += -F_j;
        fe[3] += -M_j;
      }
    }
  }
  return fe;
}

/**
 * FEF contribution of a linearly varying transverse load defined over a sub-interval
 * [a, b] of the element (local coords), with intensities wA and wB (downward positive)
 * at the sub-interval endpoints.
 *
 * Uses superposition of partial UDL formulas: a partial UDL of intensity w from a to b
 * on a clamped-clamped beam of length L can be decomposed via the influence-line approach
 * or by integrating point-load FEF formulas along the segment.
 *
 * For robustness, we integrate using Simpson's rule with 32 sub-intervals.
 */
function addPartialLinearLoadFEF(
  fe: number[],
  Le: number,
  a: number,
  b: number,
  wA: number,
  wB: number,
): void {
  const n = 32;
  const h = (b - a) / n;
  for (let i = 0; i <= n; i++) {
    const x = a + i * h;
    const t = (x - a) / (b - a || 1);
    const w = wA + (wB - wA) * t;
    // Simpson weight
    const sw = i === 0 || i === n ? 1 : i % 2 === 0 ? 2 : 4;
    // Point-load FEF at distance x from left of element
    const aDist = x;
    const bDist = Le - x;
    if (aDist < 0 || bDist < 0) continue;
    const P = w; // intensity treated as concentrated when integrated
    const F_i = (P * bDist * bDist * (Le + 2 * aDist)) / (Le * Le * Le);
    const M_i = (P * aDist * bDist * bDist) / (Le * Le);
    const F_j = (P * aDist * aDist * (Le + 2 * bDist)) / (Le * Le * Le);
    const M_j = -(P * aDist * aDist * bDist) / (Le * Le);
    const factor = (sw * h) / 3;
    fe[0] += -F_i * factor;
    fe[1] += -M_i * factor;
    fe[2] += -F_j * factor;
    fe[3] += -M_j * factor;
  }
}


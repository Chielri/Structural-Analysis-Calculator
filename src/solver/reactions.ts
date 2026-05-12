import type { BeamModel, ReactionResult, Load } from './types';
import {
  distTotalCentroid,
  distTotalForce,
  expandLoads,
  isDistributed,
  isMoment,
  isPoint,
  pointVerticalMag,
} from './utils';

/**
 * Total downward force from all loads and total clockwise moment about x=0.
 * Returns { Ftotal, Mtotal_about_origin }
 */
export function loadResultantAndMoment(loads: Load[]): { F: number; M: number } {
  let F = 0;
  let M = 0;
  for (const ld of loads) {
    if (isPoint(ld)) {
      const fy = pointVerticalMag(ld);
      F += fy;
      M += fy * ld.position; // moment about x=0, clockwise from downward load = +ve (sagging-side convention)
    } else if (isDistributed(ld)) {
      const fy = distTotalForce(ld);
      const xc = distTotalCentroid(ld);
      F += fy;
      M += fy * xc;
    } else if (isMoment(ld)) {
      // applied moment, clockwise positive
      M += ld.magnitude;
    }
  }
  return { F, M };
}

/**
 * Classify supports & calculate degree of static indeterminacy.
 * Reaction count: pin=2 (Fx, Fy), roller=1 (Fy), fixed=3 (Fx, Fy, Mz), spring=1 (Fy via stiffness)
 * Equilibrium equations: 3
 * Hinges: each adds 1 equation (moment release).
 * Degree = R - 3 - hinges. If <0 → unstable, ==0 → determinate, >0 → indeterminate.
 */
export function classifyBeam(model: BeamModel): {
  degree: number;
  reactionCount: number;
  classification: string;
} {
  let R = 0;
  for (const s of model.supports) {
    if (s.type === 'pin') R += 2;
    else if (s.type === 'roller') R += 1;
    else if (s.type === 'fixed') R += 3;
    else if (s.type === 'spring') R += 1;
  }
  const eqs = 3 + model.hinges.length;
  const degree = R - eqs;
  let classification: string;
  if (degree < 0) classification = 'unstable / mechanism';
  else if (degree === 0) classification = 'statically determinate';
  else classification = `statically indeterminate (degree ${degree})`;
  return { degree, reactionCount: R, classification };
}

/**
 * Solve reactions for a statically determinate beam using equilibrium.
 *
 * Convention:
 * - Load forces are positive downward.
 * - Reactions Fy are positive upward.
 * - Moments are positive clockwise.
 * - Mz reactions returned with the same convention (clockwise +).
 *
 * Supports handled:
 * - Cantilever (one fixed)
 * - Simply supported / overhanging (pin + roller, or 2 rollers + something for horiz)
 * - Beams with internal hinges (using stiffness method via indeterminate solver — see solve())
 *
 * For internal-hinge beams in this function we add ONE extra equation per hinge:
 * sum of moments about hinge from one side = 0.
 *
 * Builds a linear system A·x = b where x = unknown reaction components.
 */
export function solveReactionsEquilibrium(model: BeamModel): ReactionResult[] {
  const loads = expandLoads(model);
  const supports = [...model.supports].sort((a, b) => a.position - b.position);

  // Unknown vector: for each support, list its reaction components in order [Fx?, Fy, Mz?]
  // We'll track them via a mapping.
  type Unknown = {
    supportIdx: number;
    component: 'Fx' | 'Fy' | 'Mz';
    position: number;
  };
  const unknowns: Unknown[] = [];
  for (let i = 0; i < supports.length; i++) {
    const s = supports[i];
    if (s.type === 'pin') {
      unknowns.push({ supportIdx: i, component: 'Fx', position: s.position });
      unknowns.push({ supportIdx: i, component: 'Fy', position: s.position });
    } else if (s.type === 'roller') {
      unknowns.push({ supportIdx: i, component: 'Fy', position: s.position });
    } else if (s.type === 'fixed') {
      unknowns.push({ supportIdx: i, component: 'Fx', position: s.position });
      unknowns.push({ supportIdx: i, component: 'Fy', position: s.position });
      unknowns.push({ supportIdx: i, component: 'Mz', position: s.position });
    } else if (s.type === 'spring') {
      // For determinate case, treat spring like a roller (force unknown)
      unknowns.push({ supportIdx: i, component: 'Fy', position: s.position });
    }
  }

  const nUnknowns = unknowns.length;
  // System rows: ΣFx=0, ΣFy=0, ΣMz_about_origin=0, plus one moment-release equation per hinge
  // For determinate: nUnknowns must equal 3 + hinges
  const nEqs = 3 + model.hinges.length;

  if (nUnknowns !== nEqs) {
    throw new Error(
      `Beam is not statically determinate (unknowns=${nUnknowns}, equations=${nEqs}). Use stiffness method.`,
    );
  }

  // Build matrix A (nEqs × nUnknowns) and vector b (nEqs)
  const A: number[][] = Array.from({ length: nEqs }, () => new Array(nUnknowns).fill(0));
  const b: number[] = new Array(nEqs).fill(0);

  // Compute load resultants
  const { F: Ftotal, M: Mtotal } = loadResultantAndMoment(loads);
  // Horizontal component of point loads (angle != 0); positive = to the right
  let Fx_load = 0;
  for (const ld of loads) {
    if (ld.kind === 'point' && ld.angle) {
      Fx_load += ld.magnitude * Math.sin((ld.angle * Math.PI) / 180);
    }
  }

  // Eq 0: ΣFx = 0  ⇒  ΣFx_reactions + Fx_load = 0  (Fx reaction positive to right)
  // Convention: reaction Fx is to the right.
  for (let i = 0; i < unknowns.length; i++) {
    if (unknowns[i].component === 'Fx') A[0][i] = 1;
  }
  b[0] = -Fx_load;

  // Eq 1: ΣFy = 0  ⇒ ΣFy_reactions - Ftotal = 0  (Fy reaction positive upward, load Ftotal positive downward)
  for (let i = 0; i < unknowns.length; i++) {
    if (unknowns[i].component === 'Fy') A[1][i] = 1;
  }
  b[1] = Ftotal;

  // Eq 2: ΣM_about_origin = 0
  // Positive moment convention: clockwise (consistent with load moment calc).
  // A downward load at x produces +x*F clockwise moment about origin → already used in loadResultantAndMoment.
  // An upward reaction Fy at x_s produces -x_s * Fy clockwise moment about origin.
  // A reaction moment Mz (clockwise +) contributes +Mz.
  for (let i = 0; i < unknowns.length; i++) {
    const u = unknowns[i];
    if (u.component === 'Fy') A[2][i] = -u.position;
    if (u.component === 'Mz') A[2][i] = 1;
    // Fx contributes zero about origin if beam is horizontal at y=0.
  }
  b[2] = -Mtotal;

  // Hinge equations: at each hinge, the moment of all forces+moments on one side = 0.
  // We choose the LEFT side of the hinge for the contribution.
  // ΣM_about_hinge (from left side) = 0
  for (let h = 0; h < model.hinges.length; h++) {
    const xH = model.hinges[h].position;
    const row = 3 + h;
    // reactions to the left of hinge
    for (let i = 0; i < unknowns.length; i++) {
      const u = unknowns[i];
      if (u.position >= xH) continue;
      if (u.component === 'Fy') A[row][i] = -(xH - u.position); // upward reaction at x<xH: ccw about hinge = -clockwise
      if (u.component === 'Mz') A[row][i] = 1;
    }
    // load moments from left of hinge
    let Mload_left = 0;
    for (const ld of loads) {
      if (ld.kind === 'point') {
        if (ld.position < xH) {
          const fy = pointVerticalMag(ld);
          Mload_left += fy * (xH - ld.position); // downward load at x<xH: clockwise about hinge = +
        }
      } else if (ld.kind === 'moment') {
        if (ld.position < xH) Mload_left += ld.magnitude;
      } else if (ld.kind === 'distributed') {
        if (ld.startPos < xH) {
          // distributed load truncated to [startPos, min(endPos, xH)]
          const f = (() => {
            const xEnd = Math.min(ld.endPos, xH);
            if (xEnd <= ld.startPos) return { force: 0, xc: ld.startPos };
            const a = ld.startMag;
            const tEnd = (xEnd - ld.startPos) / (ld.endPos - ld.startPos);
            const wEnd = ld.startMag + (ld.endMag - ld.startMag) * tEnd;
            const L = xEnd - ld.startPos;
            const force = 0.5 * (a + wEnd) * L;
            const xcRel = (a + wEnd) === 0 ? 0 : (L * (a + 2 * wEnd)) / (3 * (a + wEnd));
            const xc = ld.startPos + xcRel;
            return { force, xc };
          })();
          Mload_left += f.force * (xH - f.xc);
        }
      }
    }
    b[row] = -Mload_left;
  }

  // Solve linear system using Gaussian elimination
  const x = gaussSolve(A, b);

  // Map back to reactions per support
  const reactionsBySupport: Map<number, ReactionResult> = new Map();
  for (let i = 0; i < unknowns.length; i++) {
    const u = unknowns[i];
    const support = supports[u.supportIdx];
    let r = reactionsBySupport.get(u.supportIdx);
    if (!r) {
      r = { supportId: support.id, position: support.position, Fy: 0 };
      reactionsBySupport.set(u.supportIdx, r);
    }
    if (u.component === 'Fx') r.Fx = x[i];
    if (u.component === 'Fy') r.Fy = x[i];
    if (u.component === 'Mz') r.Mz = x[i];
  }
  return Array.from(reactionsBySupport.values()).sort((a, b) => a.position - b.position);
}

/** Solve linear system Ax = b via Gaussian elimination with partial pivoting. */
export function gaussSolve(Ain: number[][], bin: number[]): number[] {
  const n = Ain.length;
  const A = Ain.map((row) => row.slice());
  const b = bin.slice();
  for (let i = 0; i < n; i++) {
    // pivot
    let maxRow = i;
    let maxVal = Math.abs(A[i][i]);
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxVal) {
        maxVal = Math.abs(A[k][i]);
        maxRow = k;
      }
    }
    if (maxVal < 1e-12) {
      throw new Error('Singular matrix in equilibrium solver');
    }
    if (maxRow !== i) {
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [b[i], b[maxRow]] = [b[maxRow], b[i]];
    }
    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
      b[k] -= factor * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) sum -= A[i][j] * x[j];
    x[i] = sum / A[i][i];
  }
  return x;
}

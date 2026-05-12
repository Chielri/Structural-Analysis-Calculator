import type { BeamModel, ReactionResult, DiagramPoint } from './types';
import {
  buildSampleX,
  distCentroidUpTo,
  distForceUpTo,
  expandLoads,
  isDistributed,
  isMoment,
  isPoint,
  pointVerticalMag,
} from './utils';

/**
 * Bending moment at position x, computed from the LEFT side.
 *
 * Sagging-positive convention:
 * - Upward force F at xF < x: M += F * (x - xF)
 * - Downward load P at xP < x: M -= P * (x - xP)
 * - Clockwise applied moment M0 at xm < x: M += M0
 * - Reaction Mz at xR < x (CW+): M += Mz
 */
export function momentAt(model: BeamModel, reactions: ReactionResult[], x: number): number {
  let M = 0;
  const loads = expandLoads(model);

  for (const r of reactions) {
    if (r.position <= x + 1e-12) {
      M += r.Fy * (x - r.position);
      if (r.Mz) M += r.Mz;
    }
  }
  for (const ld of loads) {
    if (isPoint(ld)) {
      if (ld.position < x) M -= pointVerticalMag(ld) * (x - ld.position);
    } else if (isDistributed(ld)) {
      if (ld.startPos < x) {
        const F = distForceUpTo(ld, x);
        const xc = distCentroidUpTo(ld, x);
        M -= F * (x - xc);
      }
    } else if (isMoment(ld)) {
      if (ld.position < x) M += ld.magnitude;
    }
  }
  return M;
}

export function buildBMD(model: BeamModel, reactions: ReactionResult[]): DiagramPoint[] {
  const xs = buildSampleX(model);
  return xs.map((x) => ({ x, value: momentAt(model, reactions, x) }));
}

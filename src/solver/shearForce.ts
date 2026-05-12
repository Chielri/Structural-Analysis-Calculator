import type { BeamModel, ReactionResult, DiagramPoint } from './types';
import {
  buildSampleX,
  distForceUpTo,
  expandLoads,
  isDistributed,
  isPoint,
  pointVerticalMag,
} from './utils';

/**
 * Shear force at position x, computed from the LEFT side.
 *
 * V(x) = Σ(upward reactions Fy to left of x) - Σ(downward loads to left of x)
 *
 * Convention:
 * - reactions Fy are stored as upward-positive (kN)
 * - loads are stored as downward-positive (kN)
 * - so V > 0 means net upward force to the left (positive shear, standard beam convention)
 */
export function shearAt(model: BeamModel, reactions: ReactionResult[], x: number): number {
  let V = 0;
  const loads = expandLoads(model);

  for (const r of reactions) {
    if (r.position < x) V += r.Fy;
  }
  for (const ld of loads) {
    if (isPoint(ld)) {
      if (ld.position < x) V -= pointVerticalMag(ld);
    } else if (isDistributed(ld)) {
      if (ld.startPos < x) V -= distForceUpTo(ld, x);
    }
    // applied moments do not affect shear
  }
  return V;
}

/**
 * Build the shear force diagram array along the beam.
 * Captures discontinuities at point loads and reactions by sampling x⁻ and x⁺.
 */
export function buildSFD(model: BeamModel, reactions: ReactionResult[]): DiagramPoint[] {
  const xs = buildSampleX(model);
  const result: DiagramPoint[] = xs.map((x) => ({
    x,
    value: shearAt(model, reactions, x),
  }));
  return result;
}

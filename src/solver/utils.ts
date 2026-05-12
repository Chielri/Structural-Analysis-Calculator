import type { BeamModel, DistributedLoad, Load, PointLoad, AppliedMoment } from './types';

export const G = 9.81; // m/s²

export function isPoint(l: Load): l is PointLoad {
  return l.kind === 'point';
}
export function isMoment(l: Load): l is AppliedMoment {
  return l.kind === 'moment';
}
export function isDistributed(l: Load): l is DistributedLoad {
  return l.kind === 'distributed';
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Trapezoidal integration over an array of {x, value} pairs. */
export function trapz(arr: { x: number; value: number }[]): number {
  let sum = 0;
  for (let i = 1; i < arr.length; i++) {
    sum += 0.5 * (arr[i].value + arr[i - 1].value) * (arr[i].x - arr[i - 1].x);
  }
  return sum;
}

/** Cumulative trapezoidal integration. Returns array of same length. */
export function cumTrapz(arr: { x: number; value: number }[]): number[] {
  const out = new Array(arr.length).fill(0);
  let acc = 0;
  out[0] = 0;
  for (let i = 1; i < arr.length; i++) {
    acc += 0.5 * (arr[i].value + arr[i - 1].value) * (arr[i].x - arr[i - 1].x);
    out[i] = acc;
  }
  return out;
}

/**
 * Intensity of a distributed load at position x.
 * Linear interpolation between startMag and endMag for startPos ≤ x ≤ endPos.
 */
export function distIntensityAt(d: DistributedLoad, x: number): number {
  if (x < d.startPos || x > d.endPos) return 0;
  const span = d.endPos - d.startPos;
  if (span <= 0) return 0;
  const t = (x - d.startPos) / span;
  return lerp(d.startMag, d.endMag, t);
}

/**
 * Total downward force from a distributed load between [0, xLimit] (or full span if xLimit >= endPos).
 * Returns kN (positive = downward).
 */
export function distForceUpTo(d: DistributedLoad, xLimit: number): number {
  if (xLimit <= d.startPos) return 0;
  const xEnd = Math.min(xLimit, d.endPos);
  // Trapezoidal area between d.startPos and xEnd
  const wStart = d.startMag;
  const wEnd = distIntensityAt(d, xEnd);
  return 0.5 * (wStart + wEnd) * (xEnd - d.startPos);
}

/** Centroid (x-position) of the load resultant for distributed load [0, xLimit]. */
export function distCentroidUpTo(d: DistributedLoad, xLimit: number): number {
  if (xLimit <= d.startPos) return d.startPos;
  const xEnd = Math.min(xLimit, d.endPos);
  const a = d.startMag;
  const b = distIntensityAt(d, xEnd);
  const L = xEnd - d.startPos;
  if (a + b === 0 || L === 0) return d.startPos;
  // Centroid of trapezoid measured from start: L * (a + 2b) / (3(a+b))
  const xc = L * (a + 2 * b) / (3 * (a + b));
  return d.startPos + xc;
}

/** Total downward force of full distributed load. */
export function distTotalForce(d: DistributedLoad): number {
  return 0.5 * (d.startMag + d.endMag) * (d.endPos - d.startPos);
}

/** Centroid of full distributed load (from origin). */
export function distTotalCentroid(d: DistributedLoad): number {
  const a = d.startMag;
  const b = d.endMag;
  const L = d.endPos - d.startPos;
  if (a + b === 0 || L === 0) return (d.startPos + d.endPos) / 2;
  const xc = L * (a + 2 * b) / (3 * (a + b));
  return d.startPos + xc;
}

/** Effective vertical magnitude of a point load (handles angle). */
export function pointVerticalMag(p: PointLoad): number {
  if (!p.angle) return p.magnitude;
  // angle is from vertical; component along vertical = mag * cos(angle)
  return p.magnitude * Math.cos((p.angle * Math.PI) / 180);
}

/** Generate self-weight UDL given section area and material density (kg/m³). Returns kN/m. */
export function selfWeightUDL(area: number, density: number): number {
  // weight per unit length = ρ * A * g (N/m) = / 1000 for kN/m
  return (density * area * G) / 1000;
}

/**
 * Build expanded loads array including auto self-weight if enabled.
 */
export function expandLoads(model: BeamModel): Load[] {
  const loads: Load[] = [...model.loads];
  if (model.selfWeight && model.section.A && model.material.density) {
    const w = selfWeightUDL(model.section.A, model.material.density);
    if (w > 0) {
      loads.push({
        kind: 'distributed',
        id: '__self_weight__',
        startPos: 0,
        endPos: model.length,
        startMag: w,
        endMag: w,
      });
    }
  }
  return loads;
}

/** Sample positions for diagrams, including discontinuity points. */
export function buildSampleX(model: BeamModel, n = 500): number[] {
  const L = model.length;
  const pts = new Set<number>();
  pts.add(0);
  pts.add(L);
  const step = L / n;
  for (let i = 1; i < n; i++) pts.add(i * step);

  for (const s of model.supports) {
    pts.add(s.position);
    pts.add(Math.max(0, s.position - 1e-9));
    pts.add(Math.min(L, s.position + 1e-9));
  }
  for (const h of model.hinges) pts.add(h.position);
  for (const ld of model.loads) {
    if (ld.kind === 'point') {
      // duplicate to capture the discontinuity
      pts.add(Math.max(0, ld.position - 1e-9));
      pts.add(Math.min(L, ld.position + 1e-9));
    } else if (ld.kind === 'moment') {
      pts.add(Math.max(0, ld.position - 1e-9));
      pts.add(Math.min(L, ld.position + 1e-9));
    } else if (ld.kind === 'distributed') {
      pts.add(ld.startPos);
      pts.add(ld.endPos);
    }
  }
  return Array.from(pts).sort((a, b) => a - b);
}

export function roundTo(v: number, decimals = 6): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

export function makeId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

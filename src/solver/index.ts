import type { AnalysisResults, BeamModel } from './types';
import { classifyBeam, solveReactionsEquilibrium } from './reactions';
import { solveStiffness } from './indeterminate';
import { buildSFD } from './shearForce';
import { buildBMD } from './bendingMoment';
import { buildDeflection } from './deflection';
import { bendingStress, extremeFiberC, shearStress } from './stress';

export * from './types';
export { classifyBeam } from './reactions';

export function validate(model: BeamModel): string[] {
  const errors: string[] = [];
  if (model.length <= 0) errors.push('Beam length must be greater than zero.');
  if (model.supports.length === 0) errors.push('At least one support is required.');
  if (!(model.section.I > 0)) errors.push('Section moment of inertia I must be positive.');
  if (!(model.material.E > 0)) errors.push("Material Young's modulus E must be positive.");
  for (const s of model.supports) {
    if (s.position < 0 || s.position > model.length)
      errors.push(`Support ${s.id} is outside the beam.`);
  }
  for (const ld of model.loads) {
    if (ld.kind === 'point' || ld.kind === 'moment') {
      if (ld.position < 0 || ld.position > model.length)
        errors.push(`Load ${ld.id} is outside the beam.`);
    } else if (ld.kind === 'distributed') {
      if (ld.startPos < 0 || ld.endPos > model.length || ld.startPos >= ld.endPos)
        errors.push(`Distributed load ${ld.id} extents are invalid.`);
    }
  }
  // duplicate-position supports
  const positions = new Map<number, number>();
  for (const s of model.supports) {
    const key = Math.round(s.position * 1e6) / 1e6;
    positions.set(key, (positions.get(key) ?? 0) + 1);
  }
  for (const [, count] of positions) {
    if (count > 1) errors.push('Duplicate supports at the same position.');
  }
  return errors;
}

/**
 * Main entry point: solve a beam model end-to-end.
 *
 * Automatically picks equilibrium vs. stiffness method based on determinacy.
 * Builds SFD, BMD, deflection, and stress results.
 */
export function solve(model: BeamModel): AnalysisResults {
  const errors = validate(model);
  if (errors.length) {
    throw new Error('Invalid beam model: ' + errors.join(' '));
  }

  const cls = classifyBeam(model);
  const warnings: string[] = [];
  let reactions;
  let method: 'equilibrium' | 'stiffness';

  const hasSpring = model.supports.some((s) => s.type === 'spring');
  const hasHinges = model.hinges.length > 0;

  if (cls.degree < 0) {
    throw new Error('Beam is unstable (insufficient supports).');
  }

  if (cls.degree === 0 && !hasSpring && !hasHinges) {
    try {
      reactions = solveReactionsEquilibrium(model);
      method = 'equilibrium';
    } catch {
      reactions = solveStiffness(model);
      method = 'stiffness';
    }
  } else {
    reactions = solveStiffness(model);
    method = 'stiffness';
  }

  const sfd = buildSFD(model, reactions);
  const bmd = buildBMD(model, reactions);
  const { deflection, slope } = buildDeflection(model, reactions);

  const maxShear = Math.max(...sfd.map((p) => Math.abs(p.value)));
  const maxMoment = Math.max(...bmd.map((p) => p.value));
  const minMoment = Math.min(...bmd.map((p) => p.value));
  const peakM = Math.max(Math.abs(maxMoment), Math.abs(minMoment));
  const maxDeflection = Math.max(...deflection.map((p) => Math.abs(p.value)));

  const c = extremeFiberC(model);
  const maxBendingStress = c > 0 ? bendingStress(peakM, model.section.I, c) : undefined;
  const maxShearStressVal = shearStress(maxShear, model);
  const utilization =
    maxBendingStress !== undefined && model.material.fy
      ? maxBendingStress / model.material.fy
      : undefined;

  return {
    reactions,
    sfd,
    bmd,
    deflection,
    slope,
    maxShear,
    maxMoment,
    minMoment,
    maxDeflection,
    maxBendingStress,
    maxShearStress: maxShearStressVal,
    utilization,
    determinacy: { degree: cls.degree, classification: cls.classification, method },
    warnings,
  };
}

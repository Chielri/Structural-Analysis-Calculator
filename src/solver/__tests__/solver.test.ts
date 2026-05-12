import { describe, expect, test } from 'vitest';
import type { BeamModel } from '../types';
import { solve } from '../index';

const STEEL = { name: 'Steel', E: 200000 };
const SECTION = { I: 0.0001, A: 0.01, yTop: 0.1, yBot: 0.1, name: 'test' };

function makeBeam(p: Partial<BeamModel>): BeamModel {
  return {
    length: 10,
    supports: [],
    loads: [],
    hinges: [],
    section: SECTION,
    material: STEEL,
    ...p,
  };
}

describe('Statically determinate beams', () => {
  test('1. Simply supported + central point load', () => {
    const beam = makeBeam({
      length: 10,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: 10 },
      ],
      loads: [{ kind: 'point', id: 'p1', position: 5, magnitude: 20 }],
    });
    const r = solve(beam);
    expect(r.reactions[0].Fy).toBeCloseTo(10, 4);
    expect(r.reactions[1].Fy).toBeCloseTo(10, 4);
    // Max moment at midspan: PL/4
    expect(r.maxMoment).toBeCloseTo(50, 3);
    // Max deflection: PL^3/(48EI). E=200000 MPa, I=1e-4 m^4. EI = 200000*1e3*1e-4 = 20000 kN·m²
    const EI = 200000 * 1e3 * 1e-4;
    const expectedDelta_m = (20 * Math.pow(10, 3)) / (48 * EI);
    const expectedDelta_mm = expectedDelta_m * 1000;
    expect(r.maxDeflection).toBeCloseTo(expectedDelta_mm, 2);
  });

  test('2. Simply supported + UDL', () => {
    const w = 5;
    const L = 10;
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: L },
      ],
      loads: [
        {
          kind: 'distributed',
          id: 'd1',
          startPos: 0,
          endPos: L,
          startMag: w,
          endMag: w,
        },
      ],
    });
    const r = solve(beam);
    // Reactions: wL/2 each
    expect(r.reactions[0].Fy).toBeCloseTo((w * L) / 2, 3);
    expect(r.reactions[1].Fy).toBeCloseTo((w * L) / 2, 3);
    // Max moment: wL^2/8
    expect(r.maxMoment).toBeCloseTo((w * L * L) / 8, 2);
    // Max deflection: 5wL^4/(384EI)
    const EI = 200000 * 1e3 * 1e-4;
    const expectedDelta_mm = ((5 * w * Math.pow(L, 4)) / (384 * EI)) * 1000;
    expect(r.maxDeflection).toBeCloseTo(expectedDelta_mm, 1);
  });

  test('3. Simply supported + off-center point load', () => {
    const P = 10;
    const L = 10;
    const a = 3;
    const b = L - a;
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: L },
      ],
      loads: [{ kind: 'point', id: 'p1', position: a, magnitude: P }],
    });
    const r = solve(beam);
    // R_A = Pb/L, R_B = Pa/L
    expect(r.reactions[0].Fy).toBeCloseTo((P * b) / L, 4);
    expect(r.reactions[1].Fy).toBeCloseTo((P * a) / L, 4);
    // Max moment at load: Pab/L = 10*3*7/10 = 21
    expect(r.maxMoment).toBeCloseTo((P * a * b) / L, 3);
  });

  test('4. Cantilever + tip load', () => {
    const P = 10;
    const L = 6;
    const beam = makeBeam({
      length: L,
      supports: [{ id: 's1', type: 'fixed', position: 0 }],
      loads: [{ kind: 'point', id: 'p1', position: L, magnitude: P }],
    });
    const r = solve(beam);
    expect(r.reactions[0].Fy).toBeCloseTo(P, 4);
    // Reaction moment at fixed end (CW+ convention): -PL (i.e., CCW couple of magnitude PL)
    expect(r.reactions[0].Mz).toBeCloseTo(-P * L, 3);
    // Max BMD value (most negative since cantilever has hogging) at the support
    expect(r.minMoment).toBeCloseTo(-P * L, 3);
    // Max deflection: PL^3/(3EI)
    const EI = 200000 * 1e3 * 1e-4;
    const expected_mm = ((P * Math.pow(L, 3)) / (3 * EI)) * 1000;
    expect(r.maxDeflection).toBeCloseTo(expected_mm, 1);
  });

  test('5. Cantilever + UDL', () => {
    const w = 4;
    const L = 5;
    const beam = makeBeam({
      length: L,
      supports: [{ id: 's1', type: 'fixed', position: 0 }],
      loads: [
        {
          kind: 'distributed',
          id: 'd1',
          startPos: 0,
          endPos: L,
          startMag: w,
          endMag: w,
        },
      ],
    });
    const r = solve(beam);
    expect(r.reactions[0].Fy).toBeCloseTo(w * L, 3);
    // M_fixed = -wL^2/2 (CW convention → reaction Mz = -wL^2/2)
    expect(r.reactions[0].Mz).toBeCloseTo(-(w * L * L) / 2, 2);
    // Max deflection: wL^4/(8EI)
    const EI = 200000 * 1e3 * 1e-4;
    const expected_mm = ((w * Math.pow(L, 4)) / (8 * EI)) * 1000;
    expect(r.maxDeflection).toBeCloseTo(expected_mm, 1);
  });

  test('6. Simply supported + triangular load (0 at left, w0 at right)', () => {
    const w0 = 6;
    const L = 8;
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: L },
      ],
      loads: [
        {
          kind: 'distributed',
          id: 'd1',
          startPos: 0,
          endPos: L,
          startMag: 0,
          endMag: w0,
        },
      ],
    });
    const r = solve(beam);
    // Total load = w0*L/2 = 24; centroid at 2L/3 = 5.333
    // R_A = (Total)*(L - centroid)/L = 24*(8-16/3)/8 = 24*(8/3)/8 = 8
    // R_B = 24 - 8 = 16
    expect(r.reactions[0].Fy).toBeCloseTo(8, 2);
    expect(r.reactions[1].Fy).toBeCloseTo(16, 2);
    // Max moment: w0*L^2 / (9*sqrt(3)) = 6*64 / (9*1.732) ≈ 24.63
    expect(r.maxMoment).toBeCloseTo((w0 * L * L) / (9 * Math.sqrt(3)), 1);
  });

  test('7. Overhanging beam + point load on overhang', () => {
    const P = 8;
    const L = 12;
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 2 },
        { id: 's2', type: 'roller', position: 10 },
      ],
      loads: [{ kind: 'point', id: 'p1', position: L, magnitude: P }],
    });
    const r = solve(beam);
    // ΣFy: R1 + R2 = 8
    // ΣM at s1 (x=2): R2*(10-2) - P*(12-2) = 0  → R2 = 10*P/8 = 10
    // R1 = 8 - 10 = -2 (downward)
    expect(r.reactions[0].Fy).toBeCloseTo(-2, 3);
    expect(r.reactions[1].Fy).toBeCloseTo(10, 3);
  });

  test('8. Simply supported + applied moment', () => {
    const M0 = 20;
    const L = 10;
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: L },
      ],
      loads: [{ kind: 'moment', id: 'm1', position: 5, magnitude: M0 }],
    });
    const r = solve(beam);
    // From analysis: R_pin = -M0/L = -2, R_roller = M0/L = +2
    expect(r.reactions[0].Fy).toBeCloseTo(-2, 3);
    expect(r.reactions[1].Fy).toBeCloseTo(2, 3);
  });

  test('9. Multiple loads (superposition)', () => {
    const L = 10;
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: L },
      ],
      loads: [
        { kind: 'point', id: 'p1', position: 5, magnitude: 20 },
        {
          kind: 'distributed',
          id: 'd1',
          startPos: 0,
          endPos: L,
          startMag: 5,
          endMag: 5,
        },
      ],
    });
    const r = solve(beam);
    // Point load: 10 each. UDL: 25 each. Total: 35 each.
    expect(r.reactions[0].Fy).toBeCloseTo(35, 2);
    expect(r.reactions[1].Fy).toBeCloseTo(35, 2);
  });

  test('11. Propped cantilever + UDL (indeterminate)', () => {
    const w = 6;
    const L = 8;
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'fixed', position: 0 },
        { id: 's2', type: 'roller', position: L },
      ],
      loads: [
        {
          kind: 'distributed',
          id: 'd1',
          startPos: 0,
          endPos: L,
          startMag: w,
          endMag: w,
        },
      ],
    });
    const r = solve(beam);
    // Standard result: R_roller = 3wL/8
    expect(r.reactions[1].Fy).toBeCloseTo((3 * w * L) / 8, 2);
    // R_fixed = 5wL/8
    expect(r.reactions[0].Fy).toBeCloseTo((5 * w * L) / 8, 2);
    // M_fixed = -wL^2/8 (CW convention)
    expect(r.reactions[0].Mz).toBeCloseTo(-(w * L * L) / 8, 1);
  });

  test('12. Two-span continuous beam + UDL', () => {
    const w = 5;
    const L = 10; // each span 5
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: 5 },
        { id: 's3', type: 'roller', position: 10 },
      ],
      loads: [
        {
          kind: 'distributed',
          id: 'd1',
          startPos: 0,
          endPos: 10,
          startMag: w,
          endMag: w,
        },
      ],
    });
    const r = solve(beam);
    // Standard two-equal-span continuous beam under UDL:
    // R_end = 3wL_span/8 each, R_middle = 10wL_span/8 = 5wL_span/4
    const Ls = 5;
    expect(r.reactions[0].Fy).toBeCloseTo((3 * w * Ls) / 8, 1);
    expect(r.reactions[2].Fy).toBeCloseTo((3 * w * Ls) / 8, 1);
    expect(r.reactions[1].Fy).toBeCloseTo((10 * w * Ls) / 8, 1);
  });

  test('13. Simply supported + spring at midspan + central point load', () => {
    const P = 10;
    const L = 10;
    const k = 1000; // kN/m (stiff enough to take most of the load)
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'spring', position: 5, springStiffness: k },
        { id: 's3', type: 'roller', position: L },
      ],
      loads: [{ kind: 'point', id: 'p1', position: 5, magnitude: P }],
    });
    const r = solve(beam);
    // Total reaction = P
    const total = r.reactions.reduce((s, x) => s + x.Fy, 0);
    expect(total).toBeCloseTo(P, 2);
    // Spring should take significant load (most of it for high k)
    expect(r.reactions[1].Fy).toBeGreaterThan(P / 2);
  });

  test('14. Combined: UDL + point + moment (verify superposition)', () => {
    const L = 10;
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: L },
      ],
      loads: [
        {
          kind: 'distributed',
          id: 'd1',
          startPos: 0,
          endPos: L,
          startMag: 4,
          endMag: 4,
        },
        { kind: 'point', id: 'p1', position: 5, magnitude: 10 },
        { kind: 'moment', id: 'm1', position: 5, magnitude: 8 },
      ],
    });
    const r = solve(beam);
    // R_pin: UDL: 20, point: 5, moment: -8/10 = -0.8. Total: 24.2
    // R_roller: 20 + 5 + 0.8 = 25.8
    expect(r.reactions[0].Fy).toBeCloseTo(24.2, 1);
    expect(r.reactions[1].Fy).toBeCloseTo(25.8, 1);
  });

  test('15. Cantilever with two point loads', () => {
    const L = 5;
    const beam = makeBeam({
      length: L,
      supports: [{ id: 's1', type: 'fixed', position: 0 }],
      loads: [
        { kind: 'point', id: 'p1', position: 2, magnitude: 6 },
        { kind: 'point', id: 'p2', position: 5, magnitude: 4 },
      ],
    });
    const r = solve(beam);
    expect(r.reactions[0].Fy).toBeCloseTo(10, 4);
    // M_fixed = -(6*2 + 4*5) = -32 (CW convention)
    expect(r.reactions[0].Mz).toBeCloseTo(-32, 2);
  });
});

describe('Beam with internal hinge', () => {
  test('10. SS beam with internal hinge + cantilever support (3 supports + hinge)', () => {
    // Construct: fixed at 0, hinge at 5, roller at 10. Apply UDL.
    // This is a Gerber-style beam (determinate due to hinge).
    const w = 4;
    const L = 10;
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'fixed', position: 0 },
        { id: 's2', type: 'roller', position: L },
      ],
      hinges: [{ id: 'h1', position: 5 }],
      loads: [
        {
          kind: 'distributed',
          id: 'd1',
          startPos: 0,
          endPos: L,
          startMag: w,
          endMag: w,
        },
      ],
    });
    const r = solve(beam);
    // The right span [5,10] is simply supported between hinge and roller, with UDL w over its length 5.
    // Treating it like SS: R_roller = w*5/2 = 10, R_hinge_internal = 10.
    // The left "cantilever" [0,5] carries: UDL w*5 = 20 + reaction at hinge (downward on cantilever) = 10.
    // So fixed reaction Fy = 20 + 10 = 30, M_fixed = -(UDL*2.5 + 10*5) = -(50 + 50) = -100
    expect(r.reactions[0].Fy).toBeCloseTo(30, 1);
    expect(r.reactions[1].Fy).toBeCloseTo(10, 1);
    expect(r.reactions[0].Mz).toBeCloseTo(-100, 1);
  });
});

describe('SFD/BMD diagram structure', () => {
  test('SFD has expected sign at midspan SS + UDL', () => {
    const w = 5;
    const L = 10;
    const beam = makeBeam({
      length: L,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: L },
      ],
      loads: [
        {
          kind: 'distributed',
          id: 'd1',
          startPos: 0,
          endPos: L,
          startMag: w,
          endMag: w,
        },
      ],
    });
    const r = solve(beam);
    // V(0+) = R_A = 25; V(L-) = R_A - wL = -25
    const v0 = r.sfd.find((p) => p.x > 0 && p.x < 0.1)?.value ?? 0;
    expect(v0).toBeCloseTo(25, 0);
    const vL = r.sfd.find((p) => p.x > L - 0.1 && p.x < L)?.value ?? 0;
    expect(vL).toBeCloseTo(-25, 0);
  });
});

describe('Validation', () => {
  test('rejects zero-length beam', () => {
    const beam = makeBeam({
      length: 0,
      supports: [{ id: 's1', type: 'pin', position: 0 }],
    });
    expect(() => solve(beam)).toThrow(/length/i);
  });

  test('rejects no supports', () => {
    const beam = makeBeam({ supports: [] });
    expect(() => solve(beam)).toThrow(/support/i);
  });
});

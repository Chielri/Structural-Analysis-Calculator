// === GEOMETRY ===
export interface BeamModel {
  length: number;              // total span (m)
  supports: Support[];
  loads: Load[];
  hinges: Hinge[];
  section: SectionProps;
  material: MaterialProps;
  selfWeight?: boolean;
}

// === SUPPORTS ===
export type SupportType = 'pin' | 'roller' | 'fixed' | 'spring';

export interface Support {
  id: string;
  type: SupportType;
  position: number;            // distance from left end (m)
  springStiffness?: number;    // for spring supports (kN/m)
  settlement?: number;         // prescribed settlement (m)
}

// === LOADS ===
export type LoadKind = 'point' | 'moment' | 'distributed';

export interface PointLoad {
  kind: 'point';
  id: string;
  position: number;            // m
  magnitude: number;           // kN, +ve = downward
  angle?: number;              // degrees from vertical, default 0
}

export interface AppliedMoment {
  kind: 'moment';
  id: string;
  position: number;            // m
  magnitude: number;           // kN·m, +ve = clockwise
}

export interface DistributedLoad {
  kind: 'distributed';
  id: string;
  startPos: number;
  endPos: number;
  startMag: number;            // kN/m at start
  endMag: number;              // kN/m at end
}

export type Load = PointLoad | AppliedMoment | DistributedLoad;

// === HINGES ===
export interface Hinge {
  id: string;
  position: number;
}

// === SECTION ===
export interface SectionProps {
  name?: string;
  I: number;                   // moment of inertia (m⁴)
  A?: number;                  // cross-section area (m²)
  yTop?: number;               // distance from NA to top fiber (m)
  yBot?: number;               // distance from NA to bottom fiber (m)
  Z?: number;                  // section modulus (m³)
  shape?: 'I' | 'rectangle' | 'circle' | 'channel' | 'custom';
  // optional geometry for shear stress computations
  b?: number;                  // width at NA (m)
  d?: number;                  // depth (m)
}

// === MATERIAL ===
export interface MaterialProps {
  name: string;
  E: number;                   // Young's modulus (MPa)
  fy?: number;                 // yield strength (MPa)
  density?: number;            // kg/m³
}

// === RESULTS ===
export interface AnalysisResults {
  reactions: ReactionResult[];
  sfd: DiagramPoint[];
  bmd: DiagramPoint[];
  deflection: DiagramPoint[];  // mm
  slope: DiagramPoint[];       // rad
  maxShear: number;
  maxMoment: number;
  minMoment: number;
  maxDeflection: number;       // mm (absolute)
  maxBendingStress?: number;   // MPa
  maxShearStress?: number;     // MPa
  utilization?: number;        // σ_max / σ_y
  determinacy: DeterminacyInfo;
  warnings: string[];
}

export interface DeterminacyInfo {
  degree: number;              // 0 = determinate, >0 = indeterminate
  classification: string;
  method: 'equilibrium' | 'stiffness';
}

export interface ReactionResult {
  supportId: string;
  position: number;
  Fy: number;                  // kN, upward positive
  Fx?: number;                 // kN
  Mz?: number;                 // kN·m, ccw positive
}

export interface DiagramPoint {
  x: number;                   // m
  value: number;
}

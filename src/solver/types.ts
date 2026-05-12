// === GEOMETRY ===
export interface BeamModel {
  length: number;              // total span (m)
  supports: Support[];
  loads: Load[];
  hinges: Hinge[];
  section: SectionProps;
  material: MaterialProps;
  selfWeight?: boolean;
  concrete?: ConcreteDeflectionInput;
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
  // --- Concrete-specific (EC2 SS EN 1992-1-1 Cl. 7.4.3) ---
  isConcrete?: boolean;        // tags this material as RC for EC2 deflection
  fck?: number;                // characteristic cylinder compressive strength (MPa)
}

// === EC2 CONCRETE DEFLECTION INPUTS ===
export interface ConcreteDeflectionInput {
  // Reinforcement
  As: number;                  // tension steel area (mm²)
  As_prime: number;            // compression steel area (mm², 0 if none)
  d: number;                   // effective depth to tension steel centroid (mm)
  d_prime: number;             // effective depth to compression steel centroid (mm, 0 if none)
  Es: number;                  // reinforcement modulus (MPa), typically 200_000

  // Long-term (creep + shrinkage) parameters
  phi: number;                 // final creep coefficient φ(∞,t₀)
  eps_cs: number;              // total free shrinkage strain (positive = shortening)
  beta: number;                // duration factor: 1.0 short-term, 0.5 sustained
  psi2: number;                // quasi-permanent combination factor (informational; used to scale L/250 moment)

  // Optional: moment ratio at construction time, relative to quasi-permanent
  // (M_inst/M_qp). Used for the L/500 post-construction check.
  instMomentRatio?: number;    // defaults to 1.0
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
  ec2?: EC2DeflectionResult;
}

// === EC2 RESULTS ===
export interface EC2DeflectionResult {
  // Material derived
  fcm: number;                 // MPa
  fctm: number;                // MPa
  Ecm: number;                 // MPa
  Ec_eff: number;              // MPa
  alpha_e: number;             // —

  // Section
  x_I: number;                 // mm
  I_I: number;                 // mm⁴
  x_II: number;                // mm
  I_II: number;                // mm⁴

  // Cracking
  Mcr: number;                 // N·mm
  M_qp: number;                // N·mm (peak sagging moment used)
  zeta: number;                // —
  cracked: boolean;

  // Curvatures (1/mm)
  kappa_I: number;
  kappa_II: number;
  kappa_m: number;
  kappa_cs_I: number;
  kappa_cs_II: number;
  kappa_cs_m: number;

  // Deflections at the critical section (mm)
  delta_flex: number;
  delta_shrink: number;
  delta_total: number;

  // Limits (mm) and pass/fail
  L_eff: number;               // mm
  limit_L250: number;          // mm
  pass_L250: boolean;

  // L/500 — post-construction
  delta_inst: number;
  delta_post: number;
  limit_L500: number;
  pass_L500: boolean;

  // Coefficient used to convert curvature to mid-span deflection (depends on support condition)
  k_flex: number;
  k_shrink: number;

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

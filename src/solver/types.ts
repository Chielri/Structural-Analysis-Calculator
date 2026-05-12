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
  concreteDesign?: ConcreteDesignInput;
  steelDesign?: SteelDesignInput;
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
  I: number;                   // moment of inertia about strong axis (m⁴)
  A?: number;                  // cross-section area (m²)
  yTop?: number;               // distance from NA to top fiber (m)
  yBot?: number;               // distance from NA to bottom fiber (m)
  Z?: number;                  // section modulus (m³)
  shape?: 'I' | 'rectangle' | 'circle' | 'channel' | 'custom';
  // optional geometry for shear stress computations
  b?: number;                  // width at NA (m)
  d?: number;                  // depth (m)
  // === Extended steel I/H properties (EC3) ===
  // All optional. Populated for proper UB/W sections so EC3 design can run.
  iSection?: SteelISection;
}

/** EC3 I/H section, mm/mm²/mm⁴/mm⁶ units (matches EN 1993-1-1 §6 notation). */
export interface SteelISection {
  h: number;        // overall depth                     [mm]
  b: number;        // flange width                      [mm]
  tw: number;       // web thickness                     [mm]
  tf: number;       // flange thickness                  [mm]
  r: number;        // root radius (0 for welded)        [mm]
  A: number;        // gross area                        [mm²]
  Iy: number;       // 2nd moment, major (y-y)           [mm⁴]
  Iz: number;       // 2nd moment, minor (z-z)           [mm⁴]
  Wpl_y: number;    // plastic modulus, y-y              [mm³]
  Wel_y: number;    // elastic modulus, y-y              [mm³]
  It: number;       // St Venant torsion constant        [mm⁴]
  Iw: number;       // warping constant                  [mm⁶]
  welded?: boolean; // rolled or welded (LTB curve)
}

// === MATERIAL ===
export interface MaterialProps {
  name: string;
  E: number;                   // Young's modulus (MPa)
  fy?: number;                 // yield strength (MPa)
  fu?: number;                 // ultimate strength (MPa)
  density?: number;            // kg/m³
  G?: number;                  // shear modulus (MPa)
  // --- Concrete-specific (EC2 SS EN 1992-1-1) ---
  isConcrete?: boolean;
  fck?: number;                // characteristic cylinder compressive strength (MPa)
  // --- Steel-specific (EC3) ---
  isSteel?: boolean;
}

// === EC2 CONCRETE DEFLECTION INPUTS (Cl. 7.4.3 calc method) ===
export interface ConcreteDeflectionInput {
  As: number;                  // tension steel area (mm²)
  As_prime: number;            // compression steel area (mm², 0 if none)
  d: number;                   // effective depth to tension steel centroid (mm)
  d_prime: number;             // effective depth to compression steel centroid (mm, 0 if none)
  Es: number;                  // reinforcement modulus (MPa), typically 200_000

  phi: number;                 // final creep coefficient φ(∞,t₀)
  eps_cs: number;              // total free shrinkage strain (positive = shortening)
  beta: number;                // duration factor: 1.0 short-term, 0.5 sustained
  psi2: number;                // quasi-permanent combination factor

  instMomentRatio?: number;    // M_inst/M_qp; defaults to 1.0
}

// === EC2 + SG NA FULL DESIGN INPUTS ===
// Matches the build spec: §0 inputs, §1 material, §2 cover, §6 shear, §7 l/d,
// §8 crack, §10 detailing. Forces/moments in user-friendly units (kN, kNm);
// converted to N, N·mm internally.
export interface ConcreteDesignInput {
  // --- ULS demands (auto-picked from BMD/SFD if 0) ---
  M_Ed_kNm?: number;        // ULS design moment (kN·m). 0/undefined → auto.
  V_Ed_kN?: number;         // ULS design shear (kN). 0/undefined → auto.
  M_qp_kNm?: number;        // SLS quasi-permanent moment for crack check.
  ulsFactor: number;        // multiplier on peak |M| when M_Ed not given

  // --- Material partial factors / NA toggles ---
  fyk: number;              // MPa (typ 500)
  gamma_c: number;          // typ 1.5
  gamma_s: number;          // typ 1.15
  alpha_cc: number;         // SG NA = 0.85 (EC2 reco = 1.0)
  alpha_ct: number;         // SG NA = 1.0
  delta: number;            // moment redistribution ratio (0.7–1.0)

  // --- Cover / bar trial sizes ---
  cnom: number;             // nominal cover (mm)
  phi_bar: number;          // main bar diameter (mm)
  phi_bar2: number;         // comp bar diameter (mm, default = phi_bar)
  phi_link: number;         // link diameter (mm)
  bond: 'good' | 'poor';    // anchorage bond condition

  // --- Deflection (Cl. 7.4.2 + Tbl NA.5) ---
  K_sys: number;            // system factor (Tbl NA.5)
  As_prov_factor: number;   // assumed As,prov / As,req (≥ 1.0)

  // --- Crack control (Cl. 7.3.4 + Tbl NA.4) ---
  wmax: number;             // crack-width limit (mm)
  kt: number;               // SG NA = 1.0 (EC2 reco = 0.4)

  // --- Lap factor (Cl. 8.7.3) ---
  rho1_pct: number;         // % bars lapped within 0.65·l0 (for α6)
}

export interface ConcreteDesignResult {
  // Material
  fcd: number;              // MPa
  fyd: number;              // MPa
  fctm: number;             // MPa
  fctk_05: number;          // MPa
  fctd: number;             // MPa
  Ecm: number;              // MPa
  Es: number;               // MPa

  // Geometry
  b: number;                // mm
  h: number;                // mm
  d: number;                // mm
  d_prime: number;          // mm

  // Bending (§4–5)
  M_Ed: number;             // N·mm
  K: number;
  K_lim: number;
  x_over_d_lim: number;
  z: number;                // mm (lever arm used)
  As_req: number;           // mm²
  As2_req: number;          // mm² (comp steel; 0 if singly)
  As_min: number;           // mm²
  As_max: number;           // mm²
  doublyReinforced: boolean;
  compSteelYielding: boolean;
  bendingFeasible: boolean;

  // Shear (§6)
  V_Ed: number;             // N
  z_sh: number;             // mm
  nu1: number;
  cot_theta: number;        // NaN if shear infeasible
  theta_deg: number;
  VRd_max: number;          // N
  Asw_per_s_req: number;    // mm²/mm
  Asw_per_s_min: number;    // mm²/mm
  sl_max: number;           // mm
  st_max: number;           // mm
  dFtd_kN: number;          // additional tensile force ΔFtd
  shearFeasible: boolean;

  // Deflection l/d (§7)
  rho0: number;
  rho: number;
  rho2: number;
  ld_basic: number;
  ld_allow: number;
  ld_actual: number;
  pass_ld: boolean;
  As_prov_used: number;     // mm² used for stress modifier

  // Crack control (§8)
  M_qp: number;             // N·mm used
  hc_ef: number;            // mm
  rho_p_eff: number;
  alpha_e: number;
  sigma_s_qp: number;       // MPa
  eps_diff: number;
  sr_max: number;           // mm
  wk: number;               // mm
  wmax: number;             // mm (echoed for the panel)
  pass_crack: boolean;
  As_min_crack: number;     // mm² (Exp 7.1)

  // SLS stress limits (§9)
  sigma_c_lim_char: number; // MPa
  sigma_s_lim_char: number; // MPa
  sigma_s_lim_qp: number;   // MPa

  // Detailing / anchorage (§10)
  s_clear_min: number;      // mm
  fbd: number;              // MPa
  lb_rqd: number;           // mm
  lbd: number;              // mm
  l0: number;               // mm
  phi_mandrel_min: number;  // mm

  // Overall flags
  /** Design pipeline can deliver a code-compliant section as designed (bending + shear + l/d + crack with the trial or provided As). */
  feasible: boolean;
  /** True when the user-provided As satisfies As_req. NaN-clean. */
  provided_ok: boolean;
  /** Indicates whether l/d / crack used the user-provided As (true) or a trial value (false). */
  used_provided_As: boolean;
  utilization: number;      // As_req / As_prov (informational)
  warnings: string[];
}

// === EC3 STEEL DESIGN INPUTS ===
export interface SteelDesignInput {
  /** Direct ULS moment in kN·m. If 0/undefined, peak |M| from BMD is used. */
  M_Ed_kNm?: number;
  /** Direct ULS shear in kN. If 0/undefined, peak |V| from SFD is used. */
  V_Ed_kN?: number;
  ulsFactor: number;          // applied when demands auto-picked

  // Material partial factors (NA-verifiable, defaults per EN reco)
  gamma_M0: number;           // cross-section resistance (1.00)
  gamma_M1: number;           // member buckling (1.00)
  gamma_M2: number;           // tension fracture / fasteners (1.25)

  // LTB inputs
  ltbCheck: boolean;          // run LTB?
  L_unrestrained_m: number;   // length between lateral restraints (m)
  C1: number;                 // moment-distribution factor (NCCI SN003)
  kc: number;                 // χLT,mod factor (1.0 = no reduction)
  ltbMethod: 'rolled' | 'general';
  lambdaLT0: number;          // λ̄LT,0 (rolled method; default 0.4)
  beta_ltb: number;           // β (rolled method; default 0.75)

  eta_shear: number;          // η for shear area (default 1.0)
}

export interface SteelDesignResult {
  // Material
  fy: number;                 // MPa (adjusted for tf if needed)
  E: number;                  // MPa
  G: number;                  // MPa
  epsilon: number;            // √(235/fy)

  // Classification (Table 5.2)
  flangeClass: 1 | 2 | 3 | 4;
  webClass: 1 | 2 | 3 | 4;
  sectionClass: 1 | 2 | 3 | 4;
  flange_c_over_t: number;
  web_c_over_t: number;

  // Cross-section resistances
  M_Ed: number;               // N·mm
  V_Ed: number;               // N
  Mc_Rd: number;              // N·mm   (§6.2.5)
  Av: number;                 // mm²
  Vpl_Rd: number;             // N      (§6.2.6)
  shearBucklingFlag: boolean; // hw/tw > 72ε/η → EN 1993-1-5 check

  // M-V interaction
  rho_shear: number;          // 0 if VEd ≤ 0.5·Vpl
  My_V_Rd: number;            // N·mm   (§6.2.8 / eq 6.30); = Mc,Rd if no reduction

  // LTB
  ltbActive: boolean;
  Mcr: number;                // N·mm   (NCCI simplified, kz=kw=1, zg=0)
  lambda_LT: number;
  ltbCurve: 'a' | 'b' | 'c' | 'd';
  chi_LT: number;
  chi_LT_mod: number;
  f_correction: number;
  Mb_Rd: number;              // N·mm   (§6.3.2 / eq 6.55)

  // Utilization
  utilM: number;              // MEd / min(Mc,Rd or My,V,Rd, Mb,Rd)
  utilV: number;              // VEd / Vpl,Rd
  pass_M: boolean;
  pass_V: boolean;
  feasible: boolean;

  warnings: string[];
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
  ec2Design?: ConcreteDesignResult;
  ec3Design?: SteelDesignResult;
}

// === EC2 7.4.3 DEFLECTION RESULTS (kept) ===
export interface EC2DeflectionResult {
  fcm: number;
  fctm: number;
  Ecm: number;
  Ec_eff: number;
  alpha_e: number;

  x_I: number;
  I_I: number;
  x_II: number;
  I_II: number;

  Mcr: number;
  M_qp: number;
  zeta: number;
  cracked: boolean;

  kappa_I: number;
  kappa_II: number;
  kappa_m: number;
  kappa_cs_I: number;
  kappa_cs_II: number;
  kappa_cs_m: number;

  delta_flex: number;
  delta_shrink: number;
  delta_total: number;

  L_eff: number;
  limit_L250: number;
  pass_L250: boolean;

  delta_inst: number;
  delta_post: number;
  limit_L500: number;
  pass_L500: boolean;

  k_flex: number;
  k_shrink: number;

  warnings: string[];
}

export interface DeterminacyInfo {
  degree: number;
  classification: string;
  method: 'equilibrium' | 'stiffness';
}

export interface ReactionResult {
  supportId: string;
  position: number;
  Fy: number;
  Fx?: number;
  Mz?: number;
}

export interface DiagramPoint {
  x: number;
  value: number;
}

import type { SectionProps, SteelISection } from '../solver/types';

/**
 * Section library — common structural shapes.
 *
 * Units in storage (SI):
 *   I  — m⁴
 *   A  — m²
 *   yTop, yBot — m  (distance from neutral axis to extreme fiber)
 *
 * Reference values from Hibbeler 10th Edition, Appendix B (W shapes, channels).
 */

export interface NamedSection extends SectionProps {
  category: 'W' | 'UB' | 'C' | 'Rect' | 'Circle' | 'Pipe' | 'Custom';
  description?: string;
}

/**
 * EN Universal Beams (UB) — full property set so EC3 design (classification,
 * Mc,Rd, Vpl,Rd, LTB) can run end-to-end. Properties from the Tata Steel
 * "Blue Book" / BS 4-1 (rolled, S275/S355 ready).
 *
 * Units in `iSection` are mm-based (matches EN 1993-1-1).
 */
function UB(
  name: string,
  h: number, b: number, tw: number, tf: number, r: number,
  A_mm2: number,
  Iy_cm4: number, Iz_cm4: number,
  Wpl_cm3: number, Wel_cm3: number,
  It_cm4: number, Iw_cm6: number,
): NamedSection {
  const iSection: SteelISection = {
    h, b, tw, tf, r,
    A: A_mm2,
    Iy: Iy_cm4 * 1e4,
    Iz: Iz_cm4 * 1e4,
    Wpl_y: Wpl_cm3 * 1e3,
    Wel_y: Wel_cm3 * 1e3,
    It: It_cm4 * 1e4,
    Iw: Iw_cm6 * 1e6,   // 1 cm⁶ = 1e6 mm⁶
    welded: false,
  };
  return {
    category: 'UB',
    name,
    shape: 'I',
    A: A_mm2 / 1e6,                        // m²
    I: (Iy_cm4 * 1e4) / 1e12,              // mm⁴ → m⁴
    yTop: h / 2 / 1000,
    yBot: h / 2 / 1000,
    d: h / 1000,
    b: tw / 1000,                          // web width for shear
    iSection,
    description: `Universal Beam ${name}`,
  };
}

// W shapes: I and A converted from 10^6 mm^4 and mm² to m⁴ and m².
// d is total depth in mm → convert to m for yTop/yBot.
function W(name: string, A_mm2: number, d_mm: number, Ix_e6_mm4: number, bf_mm: number, tw_mm: number): NamedSection {
  const d = d_mm / 1000;
  return {
    category: 'W',
    name,
    shape: 'I',
    A: A_mm2 / 1e6,
    I: (Ix_e6_mm4 * 1e6) / 1e12,
    yTop: d / 2,
    yBot: d / 2,
    d,
    b: tw_mm / 1000, // web width for shear
    description: `Wide-flange ${name}, A=${A_mm2} mm², d=${d_mm} mm, bf=${bf_mm} mm`,
  };
}

function C(name: string, A_mm2: number, d_mm: number, Ix_e6_mm4: number, tw_mm: number): NamedSection {
  const d = d_mm / 1000;
  return {
    category: 'C',
    name,
    shape: 'channel',
    A: A_mm2 / 1e6,
    I: (Ix_e6_mm4 * 1e6) / 1e12,
    yTop: d / 2,
    yBot: d / 2,
    d,
    b: tw_mm / 1000,
    description: `Channel ${name}`,
  };
}

/**
 * Common UK/EN Universal Beams. Properties: h, b, tw, tf, r [mm],
 * A [mm²], Iy, Iz [cm⁴], Wpl,y, Wel,y [cm³], It [cm⁴], Iw [10³ cm⁶ → cm⁶].
 * Source: Tata Blue Book (rolled S275/S355).
 */
export const UB_SECTIONS: NamedSection[] = [
  UB('UB 457x191x82', 460.0, 191.3, 9.9, 16.0, 10.2,
     10500, 37100, 1870, 1830, 1610, 69.2, 922000),
  UB('UB 533x210x92', 533.1, 209.3, 10.1, 15.6, 12.7,
     11700, 55200, 2390, 2360, 2070, 75.7, 1600000),
  UB('UB 406x178x60', 406.4, 177.9, 7.9, 12.8, 10.2,
     7600, 21500, 1200, 1200, 1060, 33.3, 466000),
  UB('UB 305x165x40', 303.4, 165.0, 6.0, 10.2, 8.9,
     5130, 8500, 764, 623, 559, 14.7, 184000),
  UB('UB 254x146x31', 251.4, 146.1, 6.0, 8.6, 7.6,
     3970, 4410, 448, 393, 351, 8.55, 65500),
  UB('UB 203x133x25', 203.2, 133.2, 5.7, 7.8, 7.6,
     3200, 2340, 308, 258, 230, 5.96, 22400),
];

export const WIDE_FLANGE: NamedSection[] = [
  W('W310×129', 16500, 318, 308, 308.0, 13.10),
  W('W310×74', 9480, 310, 165, 205.0, 9.40),
  W('W310×67', 8530, 306, 145, 204.0, 8.51),
  W('W310×39', 4930, 310, 84.8, 165.0, 5.84),
  W('W310×33', 4180, 313, 65.0, 102.0, 6.60),
  W('W310×24', 3040, 305, 42.8, 101.0, 5.59),
  W('W310×21', 2680, 303, 37.0, 101.0, 5.08),
  W('W250×149', 19000, 282, 259, 263.0, 17.30),
  W('W250×80', 10200, 256, 126, 255.0, 9.40),
  W('W250×67', 8560, 257, 104, 204.0, 8.89),
  W('W250×58', 7400, 252, 87.3, 203.0, 8.00),
  W('W250×45', 5700, 266, 71.1, 148.0, 7.62),
  W('W250×28', 3620, 260, 39.9, 102.0, 6.35),
  W('W250×22', 2850, 254, 28.8, 102.0, 5.84),
  W('W250×18', 2280, 251, 22.5, 101.0, 4.83),
  W('W200×100', 12700, 229, 113, 210.0, 14.50),
  W('W200×86', 11000, 222, 94.7, 209.0, 13.00),
  W('W200×71', 9100, 216, 76.6, 206.0, 10.20),
  W('W200×59', 7580, 210, 61.2, 205.0, 9.14),
  W('W200×46', 5890, 203, 45.5, 203.0, 7.24),
  W('W200×36', 4570, 201, 34.4, 165.0, 6.22),
  W('W200×22', 2860, 206, 20.0, 102.0, 6.22),
  W('W150×37', 4730, 162, 22.2, 154.0, 8.13),
  W('W150×30', 3790, 157, 17.1, 153.0, 6.60),
  W('W150×22', 2860, 152, 12.1, 152.0, 5.84),
  W('W150×24', 3060, 160, 13.4, 102.0, 6.60),
  W('W150×18', 2290, 153, 9.19, 102.0, 5.84),
  W('W150×14', 1730, 150, 6.84, 100.0, 4.32),
];

export const CHANNELS: NamedSection[] = [
  C('C310×45', 5690, 305, 67.4, 13.00),
  C('C310×31', 3930, 305, 53.7, 7.16),
  C('C250×30', 3790, 254, 32.8, 9.63),
  C('C200×28', 3550, 203, 18.3, 12.40),
  C('C200×17', 2180, 203, 13.6, 5.59),
  C('C150×19', 2470, 152, 7.24, 11.10),
  C('C150×12', 1550, 152, 5.45, 5.08),
];

/** Compute rectangular section properties from b × h (mm). */
export function rectangleSection(b_mm: number, h_mm: number, name?: string): NamedSection {
  const b = b_mm / 1000;
  const h = h_mm / 1000;
  return {
    category: 'Rect',
    name: name ?? `Rectangle ${b_mm}×${h_mm}`,
    shape: 'rectangle',
    A: b * h,
    I: (b * h * h * h) / 12,
    yTop: h / 2,
    yBot: h / 2,
    d: h,
    b,
  };
}

/** Compute solid-circle section properties from diameter (mm). */
export function circleSection(d_mm: number, name?: string): NamedSection {
  const r = d_mm / 1000 / 2;
  return {
    category: 'Circle',
    name: name ?? `Circle Ø${d_mm}`,
    shape: 'circle',
    A: Math.PI * r * r,
    I: (Math.PI * Math.pow(r, 4)) / 4,
    yTop: r,
    yBot: r,
    d: 2 * r,
    b: 2 * r,
  };
}

/** Compute hollow circular tube (pipe) properties from outer and inner diameters (mm). */
export function pipeSection(od_mm: number, id_mm: number, name?: string): NamedSection {
  const R = od_mm / 1000 / 2;
  const r = id_mm / 1000 / 2;
  return {
    category: 'Pipe',
    name: name ?? `Pipe Ø${od_mm}/${id_mm}`,
    shape: 'circle',
    A: Math.PI * (R * R - r * r),
    I: (Math.PI * (Math.pow(R, 4) - Math.pow(r, 4))) / 4,
    yTop: R,
    yBot: R,
    d: 2 * R,
    b: 2 * (R - r), // approx web width for shear
  };
}

export const STANDARD_RECTANGLES: NamedSection[] = [
  rectangleSection(100, 200),
  rectangleSection(150, 300),
  rectangleSection(200, 400),
  rectangleSection(300, 600),
];

export const STANDARD_CIRCLES: NamedSection[] = [
  circleSection(50),
  circleSection(100),
  circleSection(150),
  circleSection(200),
];

export const ALL_SECTIONS: NamedSection[] = [
  ...UB_SECTIONS,
  ...WIDE_FLANGE,
  ...CHANNELS,
  ...STANDARD_RECTANGLES,
  ...STANDARD_CIRCLES,
];

export const DEFAULT_SECTION: NamedSection = WIDE_FLANGE.find((w) => w.name === 'W250×58') ?? WIDE_FLANGE[0];

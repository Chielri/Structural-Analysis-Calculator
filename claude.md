# Beam Calculator — Claude Code Project Guide

## Project Overview

A **free, open-source, browser-based structural beam calculator** inspired by [SkyCiv's Free Beam Calculator](https://skyciv.com/free-beam-calculator/). The application lets engineers and students define beams, apply supports and loads, and instantly visualize reactions, shear force diagrams (SFD), bending moment diagrams (BMD), deflection curves, and stress results — all client-side with zero backend.

**Target users:** Structural/civil engineers, engineering students, anyone needing quick beam analysis.

---

## Agent Workflow Instructions

**This is a one-shot, full-scope build.** Do not ask for confirmation between steps. Do not create partial implementations or placeholder stubs. Build the complete application end-to-end in a single session.

**Build order (strictly sequential — do not skip ahead):**

1. **Project scaffolding** — `pnpm create vite`, install all deps, configure Tailwind, create the full directory structure.
2. **Types** — implement `solver/types.ts` with all interfaces exactly as specified.
3. **Solver core** — implement every solver module (`reactions.ts`, `shearForce.ts`, `bendingMoment.ts`, `deflection.ts`, `stress.ts`, `indeterminate.ts`, `utils.ts`). Write clean, tested, pure functions.
4. **Solver tests** — write and **run** all solver unit tests. Fix bugs until all pass. Do not proceed to UI until the solver is verified.
5. **Data libraries** — section library and material library with real engineering values.
6. **Store** — Zustand store with full model, results, UI state, undo/redo history.
7. **UI components** — build all components: layout shell, sidebar inputs, SVG canvas, results panel, toolbar.
8. **Integration** — wire everything together: inputs → store → solver → results display.
9. **Polish** — theming, unit toggle, save/load, keyboard shortcuts, export, presets, error handling.
10. **Final verification** — `pnpm build` must succeed with zero errors. Run the dev server and confirm the app loads.

**Key rules:**
- Every numerical calculation MUST be executed programmatically. Never do math via token prediction.
- Solver functions must be pure — no React imports, no side effects.
- Use `mathjs` for matrix operations in the indeterminate solver.
- After writing solver tests, actually run them with `pnpm vitest run` and fix any failures before moving on.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **React 18+ with TypeScript** | Type safety for engineering math; component model fits the multi-panel UI |
| Build | **Vite** | Fast dev server, simple config |
| Styling | **Tailwind CSS 3** | Utility-first, easy theming, responsive |
| Charts / Diagrams | **D3.js** or **Recharts** for SFD/BMD/deflection plots; raw **SVG** for the beam schematic editor | Full control over engineering diagram rendering |
| Math | All analysis logic in **pure TypeScript** — no server calls | Deterministic, auditable, testable |
| State | **Zustand** (lightweight) or React Context + useReducer | Single source of truth for beam model |
| Testing | **Vitest** + React Testing Library | Unit tests for solver, integration tests for UI |
| Package manager | **pnpm** (preferred) or npm | |

### Key dependencies

```
react, react-dom, typescript, vite
tailwindcss, postcss, autoprefixer
zustand (state)
d3 (or recharts) for plotting
mathjs (optional — only if matrix ops needed for multi-span)
vitest, @testing-library/react
```

---

## Application Architecture

```
src/
├── main.tsx                   # Entry point
├── App.tsx                    # Layout shell: sidebar + canvas + results
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        # Left panel: tabbed input forms
│   │   ├── Canvas.tsx         # Center: beam schematic (SVG interactive)
│   │   ├── ResultsPanel.tsx   # Bottom / right: diagrams + tables
│   │   └── Toolbar.tsx        # Top bar: solve button, undo, units toggle
│   │
│   ├── inputs/
│   │   ├── BeamInput.tsx      # Beam length, segments
│   │   ├── SupportInput.tsx   # Add/edit supports (pin, roller, fixed, spring)
│   │   ├── PointLoadInput.tsx # Concentrated forces
│   │   ├── DistLoadInput.tsx  # UDL, triangular, trapezoidal
│   │   ├── MomentInput.tsx    # Applied moments
│   │   ├── SectionInput.tsx   # E, I, or pick from library
│   │   └── HingeInput.tsx     # Internal hinges
│   │
│   ├── canvas/
│   │   ├── BeamRenderer.tsx   # Draw the beam line
│   │   ├── SupportRenderer.tsx# Draw support symbols (triangle, rollers, wall)
│   │   ├── LoadRenderer.tsx   # Draw arrows, UDL hatching, moment arcs
│   │   └── DimensionLine.tsx  # Dimension annotations
│   │
│   ├── results/
│   │   ├── ReactionTable.tsx  # Tabular reaction forces
│   │   ├── DiagramChart.tsx   # Reusable chart for SFD / BMD / deflection
│   │   ├── StressResults.tsx  # Max bending stress σ = My/I
│   │   └── SummaryCard.tsx    # Quick stats: max moment, max deflection, etc.
│   │
│   └── ui/                    # Shared primitives: Button, Input, Select, Tabs, Modal, Tooltip
│
├── solver/
│   ├── types.ts               # Core data types (see below)
│   ├── reactions.ts           # Equilibrium solver (∑F=0, ∑M=0) for determinate beams
│   ├── shearForce.ts          # Build SFD array from loads + reactions
│   ├── bendingMoment.ts       # Build BMD array by integrating shear
│   ├── deflection.ts          # Double-integration or direct formula for deflection curve
│   ├── stress.ts              # σ = M·y / I, τ = V·Q / (I·b)
│   ├── indeterminate.ts       # Stiffness method for multi-span / redundant beams
│   └── utils.ts               # Interpolation, numerical integration helpers
│
├── store/
│   └── beamStore.ts           # Zustand store: beam model, solver results, UI state
│
├── data/
│   ├── sectionLibrary.ts      # Common sections: I-beams (AISC W shapes), channels, rectangles, circles
│   └── materialLibrary.ts     # Steel, timber, concrete, aluminium — E, fy, density
│
├── utils/
│   ├── units.ts               # Unit conversion: kN↔lb, m↔ft, MPa↔ksi, etc.
│   ├── formatting.ts          # Number formatting, sig figs
│   └── export.ts              # Export results to CSV / PDF
│
├── hooks/
│   ├── useBeamModel.ts        # Convenience hook over store
│   └── useSolver.ts           # Run solver on model change, memoize results
│
└── styles/
    └── globals.css            # Tailwind directives, custom theme tokens
```

---

## Core Data Types (`solver/types.ts`)

```typescript
// === GEOMETRY ===
export interface BeamModel {
  length: number;              // total span (m or ft)
  supports: Support[];
  loads: Load[];
  hinges: Hinge[];
  section: SectionProps;
  material: MaterialProps;
}

// === SUPPORTS ===
export type SupportType = 'pin' | 'roller' | 'fixed' | 'spring';

export interface Support {
  id: string;
  type: SupportType;
  position: number;            // distance from left end
  springStiffness?: number;    // for spring supports (kN/m)
  settlement?: number;         // prescribed settlement (m)
}

// === LOADS ===
export type LoadKind = 'point' | 'moment' | 'distributed';

export interface PointLoad {
  kind: 'point';
  id: string;
  position: number;
  magnitude: number;           // +ve = downward (convention)
  angle?: number;              // degrees from vertical, default 0 (vertical)
}

export interface AppliedMoment {
  kind: 'moment';
  id: string;
  position: number;
  magnitude: number;           // +ve = clockwise
}

export interface DistributedLoad {
  kind: 'distributed';
  id: string;
  startPos: number;
  endPos: number;
  startMag: number;            // intensity at start (kN/m)
  endMag: number;              // intensity at end (allows triangular/trapezoidal)
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
  I: number;                   // moment of inertia (m⁴ or in⁴)
  A?: number;                  // cross-section area
  yTop?: number;               // distance from NA to top fiber
  yBot?: number;               // distance from NA to bottom fiber
  Z?: number;                  // section modulus (optional, derived)
}

// === MATERIAL ===
export interface MaterialProps {
  name: string;
  E: number;                   // Young's modulus (MPa)
  fy?: number;                 // yield strength
  density?: number;            // kg/m³
}

// === RESULTS ===
export interface AnalysisResults {
  reactions: ReactionResult[];
  sfd: DiagramPoint[];         // shear force diagram
  bmd: DiagramPoint[];         // bending moment diagram
  deflection: DiagramPoint[];  // deflection curve
  maxShear: number;
  maxMoment: number;
  maxDeflection: number;
  maxBendingStress?: number;
}

export interface ReactionResult {
  supportId: string;
  position: number;
  Fy: number;                  // vertical reaction
  Fx?: number;                 // horizontal reaction (fixed/pin)
  Mz?: number;                 // moment reaction (fixed only)
}

export interface DiagramPoint {
  x: number;                   // position along beam
  value: number;               // SFD / BMD / deflection value at x
}
```

---

## Solver Logic — Implementation Guide

### Statically Determinate Beams

Support these configurations first:

1. **Simply supported** (pin + roller) — most common
2. **Cantilever** (single fixed support)
3. **Overhanging beam** (pin + roller with overhang)

#### Reactions (`solver/reactions.ts`)

For a determinate beam with no internal hinges:

```
∑Fx = 0   →   Horizontal equilibrium
∑Fy = 0   →   R_A + R_B = total vertical load
∑M_A = 0  →   Solve for R_B, then back-substitute for R_A
```

For cantilever (single fixed support):
```
R_y = total vertical load
M_fixed = sum of all load × distance from fixed end
```

**All math must be executed programmatically** (not estimated). Use exact arithmetic where possible.

#### Shear Force Diagram (`solver/shearForce.ts`)

Walk left-to-right along the beam at fine increments (e.g., `length / 500` or finer):

1. Start at x = 0.
2. At each station, sum all vertical forces to the LEFT of x:
   - Upward reactions → positive shear
   - Downward point loads → negative shear
   - Distributed loads → integrate from start to min(x, endPos)
3. Record `{x, V(x)}`.

Capture discontinuities: at every point load or reaction, record the value just before AND just after.

#### Bending Moment Diagram (`solver/bendingMoment.ts`)

Two approaches (use whichever is cleaner):

- **Direct summation:** At each station x, M(x) = sum of moments of all forces to the left about point x.
- **Integration of shear:** M(x) = ∫₀ˣ V(t) dt — use the trapezoidal rule on the SFD array.

Handle applied moments as step discontinuities in BMD.

#### Deflection (`solver/deflection.ts`)

For simple cases, use **closed-form formulas** (Euler-Bernoulli beam theory):

| Case | Max Deflection |
|---|---|
| Simply supported, UDL w | δ_max = 5wL⁴ / (384EI) |
| Simply supported, central point P | δ_max = PL³ / (48EI) |
| Cantilever, tip load P | δ_max = PL³ / (3EI) |
| Cantilever, UDL w | δ_max = wL⁴ / (8EI) |

For **general loading**, use the **double integration method** numerically:
```
EI · y''(x) = M(x)
EI · y'(x)  = ∫ M(x) dx + C₁
EI · y(x)   = ∫∫ M(x) dx² + C₁x + C₂
```
Apply boundary conditions (y = 0 at supports) to solve C₁, C₂.

Use **numerical integration** (trapezoidal or Simpson's rule) over the BMD array.

#### Stress (`solver/stress.ts`)

```
σ_bending = M_max × y_max / I
τ_max = V_max × Q / (I × b)    // if section geometry is known
```

### Indeterminate Beams (Stiffness Method)

Use the **direct stiffness method** (matrix structural analysis):

1. Discretize beam into elements between supports/hinges.
2. Assemble global stiffness matrix [K].
3. Apply loads as fixed-end force vectors.
4. Solve [K]{d} = {F} for displacements.
5. Back-calculate member forces → SFD, BMD, reactions.

Use `mathjs` for matrix operations if needed.

---

## UI/UX Design Direction

### Aesthetic: **Engineering-Precision Dark Theme**

Think: CAD software meets modern web app. Clean, data-dense, professional.

- **Background:** Dark charcoal (`#1a1a2e` → `#16213e` gradient), not pure black
- **Accent:** Electric blue (`#0ea5e9`) for interactive elements, solve button, active states
- **Secondary accent:** Amber/orange (`#f59e0b`) for warnings, limit violations
- **Text:** Off-white (`#e2e8f0`) on dark, with muted grey (`#94a3b8`) for labels
- **Diagrams:** Vibrant line colors on dark canvas — blue for BMD, red for SFD, green for deflection
- **Font:** `"JetBrains Mono"` for numerical values; `"DM Sans"` or `"Outfit"` for UI labels
- **Grid lines:** Subtle dotted lines (`rgba(255,255,255,0.06)`) on chart backgrounds

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Toolbar: [Units: SI ▾] [Undo] [Redo]   [🟢 Solve]        │
├────────────┬────────────────────────────────────────────────┤
│            │                                                │
│  Sidebar   │         Beam Schematic Canvas (SVG)            │
│  (tabbed)  │    ┌──────────────────────────────────┐        │
│            │    │  ▲ P=10kN        w=5kN/m          │        │
│  • Beam    │    │  │               ░░░░░░░          │        │
│  • Supports│    │  ▼───────────────────────────────  │        │
│  • Loads   │    │  △              △                  │        │
│  • Section │    │  A    5m        B     3m           │        │
│  • Moments │    └──────────────────────────────────┘        │
│  • Hinges  │                                                │
│            ├────────────────────────────────────────────────┤
│            │         Results Tabs                           │
│            │  [Reactions] [SFD] [BMD] [Deflection] [Stress] │
│            │  ┌──────────────────────────────────────────┐  │
│            │  │  ← Interactive D3/Recharts diagram →     │  │
│            │  │  with hover tooltips showing exact vals   │  │
│            │  └──────────────────────────────────────────┘  │
│            │  Summary: Mmax = 45.2 kN·m │ δmax = 12.3 mm   │
└────────────┴────────────────────────────────────────────────┘
```

### Interactive Canvas Requirements

- The beam schematic is an **SVG canvas**, not a static image.
- Supports render as engineering symbols: triangle (pin), circle-on-line (roller), filled wall (fixed).
- Point loads render as downward arrows with magnitude labels.
- Distributed loads render as hatched rectangles with intensity labels at start/end.
- Moments render as curved arrows.
- Users can **click on the beam** to place loads/supports at that position (or type exact position).
- Hover over any element to see details; click to edit or delete.
- Dimension lines with measurements appear below the beam.

### Results Diagrams

- SFD, BMD, deflection plotted as filled-area charts (shaded between curve and x-axis).
- Positive values above axis, negative below.
- Crosshair/tooltip on hover showing exact (x, value) pair.
- Max/min values annotated with markers.
- Axis labels with units.

---

## Unit System

Support **SI** and **Imperial** with a global toggle:

| Quantity | SI | Imperial |
|---|---|---|
| Length | m | ft |
| Force | kN | kip |
| Distributed load | kN/m | kip/ft |
| Moment | kN·m | kip·ft |
| Stress | MPa | ksi |
| Deflection | mm | in |
| E (Young's mod) | MPa | ksi |
| I (inertia) | m⁴ | in⁴ |

Store internally in SI. Convert on display only.

---

## Engineering Sign Conventions

- **Loads:** Positive = downward (gravity direction)
- **Reactions:** Positive = upward
- **Shear Force:** Positive = causes clockwise rotation of beam segment (standard beam convention)
- **Bending Moment:** Positive = causes sagging (concave up, tension on bottom fiber)
- **Deflection:** Positive = downward

---

## Build Scope — Complete Feature Set (Single Pass)

This is a **one-shot, complete build**. Do not split into phases or MVP iterations. Implement everything below before considering the project done. Work through it systematically — solver first, then UI, then polish — but ship nothing partial.

### Project Setup
- [ ] Vite + React 18 + TypeScript (strict mode) + Tailwind CSS 3
- [ ] Zustand store for beam model + analysis results + UI state
- [ ] File structure matching the Architecture section exactly

### Solver (build and test FIRST, before any UI)
- [ ] Reaction solver for determinate beams: simply supported (pin+roller), cantilever (fixed), overhanging
- [ ] Reaction solver for beams with internal hinges (extra equilibrium equation per hinge)
- [ ] Indeterminate beam solver via direct stiffness method (matrix structural analysis) — supports propped cantilever, continuous beams, any redundant configuration
- [ ] Shear force diagram builder (left-to-right walk with discontinuity capture)
- [ ] Bending moment diagram builder (integration of shear + moment discontinuities)
- [ ] Deflection curve via numerical double integration of M(x)/EI with boundary conditions
- [ ] Bending stress: σ = M·y/I (top and bottom fiber)
- [ ] Shear stress: τ = V·Q/(I·b) (if section geometry is known)
- [ ] Self-weight as auto-generated UDL = section area × material density × g
- [ ] Spring support stiffness handling
- [ ] Unit tests for ALL 10+ test cases listed in the Testing section — solver must pass before UI work begins

### Input UI (Sidebar)
- [ ] Beam length input
- [ ] Support manager: add/edit/remove supports (pin, roller, fixed, spring with stiffness)
- [ ] Point load manager: position, magnitude, optional angle
- [ ] Distributed load manager: start/end position, start/end magnitude (UDL, triangular, trapezoidal)
- [ ] Applied moment manager: position, magnitude
- [ ] Hinge manager: add/remove internal hinges at positions
- [ ] Section input: manual E and I entry, OR pick from built-in section library
- [ ] Section library: common I-beams (AISC W shapes), channels, rectangular, circular, with pre-filled I, A, y_top, y_bot
- [ ] Material library: steel, timber, concrete, aluminium with E, fy, density
- [ ] Self-weight toggle
- [ ] Load case assignment per load
- [ ] Load combination manager with custom factors per load case
- [ ] Preset example beams (5 presets, loadable in one click)

### Interactive Beam Canvas (SVG)
- [ ] Beam rendered as a line with dimension annotations
- [ ] Support symbols: triangle (pin), circle-on-line (roller), filled wall bracket (fixed), spring zigzag
- [ ] Point load arrows with magnitude labels
- [ ] Distributed load hatched rectangles with start/end intensity labels
- [ ] Moment curved arrows with magnitude labels
- [ ] Hinge symbols (open circle)
- [ ] Click-to-place: click on beam to set position for new load/support, pre-filling the position field
- [ ] Hover any element → tooltip with details; click → edit or delete
- [ ] Dimension lines below beam showing distances between supports and to ends

### Results Panel
- [ ] Tabbed view: Reactions | SFD | BMD | Deflection | Stress
- [ ] Reaction table: support ID, position, Fy, Fx, Mz with units
- [ ] SFD chart: filled-area chart, positive above axis, negative below, discontinuity steps rendered cleanly
- [ ] BMD chart: same style, with max/min annotated markers
- [ ] Deflection curve chart: green line, max deflection annotated
- [ ] Stress results: max bending stress, max shear stress, utilization ratio if fy is known
- [ ] Summary card: Mmax, Vmax, δmax, σmax at a glance
- [ ] Crosshair/tooltip on hover for all diagrams showing exact (x, value)
- [ ] Export to CSV (diagram data points)
- [ ] Export to PDF report (beam schematic + all diagrams + reaction table + summary)

### Toolbar & Global
- [ ] Unit toggle: SI ↔ Imperial (all values convert live)
- [ ] Solve button (prominent, green) — validates then runs solver
- [ ] Undo / Redo (model state history)
- [ ] Save / Load beam model as JSON file
- [ ] Dark theme (default) with light theme toggle
- [ ] Keyboard shortcuts: Ctrl+Z undo, Ctrl+S save, Ctrl+Enter solve
- [ ] Responsive layout: usable on tablet, gracefully degrades on mobile
- [ ] Error/validation toasts for invalid configurations

---

## Validation & Testing Strategy

### Solver unit tests (critical)

Every solver function must have tests against known analytical solutions:

```typescript
// Example: simply supported beam, central point load
test('simply supported beam with central point load', () => {
  const beam: BeamModel = {
    length: 10,
    supports: [
      { id: 's1', type: 'pin', position: 0 },
      { id: 's2', type: 'roller', position: 10 },
    ],
    loads: [
      { kind: 'point', id: 'p1', position: 5, magnitude: 20 },
    ],
    hinges: [],
    section: { I: 0.0001, name: 'test' },
    material: { name: 'steel', E: 200000 },
  };

  const results = solve(beam);

  // Reactions: symmetric → 10 kN each
  expect(results.reactions[0].Fy).toBeCloseTo(10, 4);
  expect(results.reactions[1].Fy).toBeCloseTo(10, 4);

  // Max moment at midspan: PL/4 = 20×10/4 = 50 kN·m
  expect(results.maxMoment).toBeCloseTo(50, 4);

  // Max deflection: PL³/(48EI)
  const expected_delta = (20 * Math.pow(10, 3)) / (48 * 200000 * 0.0001);
  expect(results.maxDeflection).toBeCloseTo(expected_delta, 4);
});
```

Test cases to implement:
1. Simply supported + central point load
2. Simply supported + UDL
3. Simply supported + off-center point load
4. Cantilever + tip load
5. Cantilever + UDL
6. Simply supported + triangular load
7. Overhanging beam + point load on overhang
8. Beam with applied moment
9. Multiple loads combined
10. Beam with internal hinge
11. Propped cantilever (fixed + roller) + UDL — indeterminate, verify against known: R_roller = 3wL/8
12. Two-span continuous beam (3 supports, pin-roller-roller) + UDL on both spans
13. Simply supported beam with spring support at midspan
14. Combined: UDL + point load + moment on simply supported beam — verify superposition
15. Cantilever with two point loads at different positions

### UI integration tests

- Adding/removing supports updates the canvas
- Solve button triggers analysis and renders diagrams
- Unit toggle converts all displayed values
- Invalid configurations show error messages (e.g., beam with no supports, insufficient supports for determinacy)

---

## Error Handling & Validation

Before solving, validate:

1. **Beam length > 0**
2. **At least one support exists**
3. **Determinacy check:** Classify the beam automatically:
   - Simply supported (1 pin + 1 roller) = determinate → use equilibrium solver
   - Cantilever (1 fixed) = determinate → use equilibrium solver
   - With internal hinges → add hinge equations, check if determinate
   - If indeterminate → automatically route to stiffness method solver
4. **Supports within beam length**
5. **Loads within beam length**
6. **No duplicate supports at same position**
7. **Section properties > 0** (E, I must be positive)

Show inline validation errors, not just console errors. Use toast notifications for solve-time errors.

---

## Code Style & Conventions

- **Strict TypeScript** — no `any` types in solver code
- **Pure functions** for all solver logic — no side effects, easy to test
- **Descriptive variable names** — `shearForceAtX` not `v`, `bendingMomentAtX` not `m`
- **Comments for engineering formulas** — cite the equation source (e.g., "Euler-Bernoulli beam theory, δ = PL³/48EI")
- **SI units internally** — all conversions happen at the display layer
- **Solver and UI are strictly separated** — solver knows nothing about React
- **Every numerical calculation uses programmatic computation** — never rely on LLM token prediction for math

---

## Performance Considerations

- SFD/BMD arrays: 500–1000 points for smooth curves. More is unnecessary for typical beams.
- Solver runs synchronously for determinate beams (fast enough). Use Web Worker for the stiffness method matrix solver if beam has many elements.
- Memoize solver results (`useMemo`) — only re-solve when model changes.
- SVG canvas: limit DOM nodes. Use `<path>` for continuous curves, not individual `<circle>` per point.

---

## Accessibility

- All inputs have labels
- Keyboard navigable (tab through sidebar, Enter to solve)
- Diagram tooltips readable by screen readers (aria-live regions for result summaries)
- Color-blind safe: don't rely on color alone — use line patterns (dashed/solid/dotted) alongside colors for SFD/BMD/deflection

---

## Example Presets

Include 3–5 preset beam configurations users can load instantly:

1. **Simply supported + UDL** — L=10m, w=5 kN/m, pin+roller
2. **Cantilever + tip load** — L=6m, P=10 kN at tip, fixed at left
3. **Simply supported + two point loads** — L=8m, P₁=15 kN at 2m, P₂=10 kN at 6m
4. **Overhanging beam** — L=12m, supports at 2m and 10m, P=8 kN at 12m
5. **Combined loading** — UDL + point load + applied moment

---

## References

- Euler-Bernoulli Beam Theory
- Hibbeler, R.C. — *Structural Analysis* (standard textbook reference)
- SkyCiv Beam Deflection Formulas: https://skyciv.com/docs/tutorials/beam-tutorials/what-is-deflection/
- Sign conventions: https://skyciv.com/docs/structural-3d/post-processing/sign-conventions/

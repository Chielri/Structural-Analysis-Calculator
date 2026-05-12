# Beam Calculator — Structural Analysis

Free, open-source, browser-based structural beam calculator inspired by SkyCiv's
Free Beam Calculator. Define beams, supports, and loads — instantly see reactions,
shear-force / bending-moment / deflection diagrams, and stress results — all
client-side with zero backend.

## Features

- Statically determinate and indeterminate beam solver (direct stiffness method)
- Supports: pin, roller, fixed, spring (with stiffness), settlement
- Loads: point loads (with optional angle), UDL / triangular / trapezoidal
  distributed loads, applied moments
- Internal hinges
- Self-weight from section area and material density
- SVG beam schematic with engineering symbols
- Interactive SFD / BMD / deflection charts with hover crosshair
- Bending and shear stress (σ = M·c/I, τ ≈ k·V/A) with utilization
- SI ↔ Imperial unit toggle
- Save / load model as JSON
- Export results to CSV; export PDF report (print dialog)
- 5 preset examples (SS+UDL, cantilever, two-point, overhanging, combined)
- Undo / redo with model-state history
- Keyboard shortcuts: Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo, Ctrl+S save,
  Ctrl+Enter solve
- Section library: AISC W-shapes, channels, rectangles, circles, pipes
- Material library: structural steel, aluminium, concrete, timber, stainless,
  titanium

## Tech Stack

React 18 · TypeScript (strict) · Vite · Tailwind 3 · Zustand · Recharts · Vitest

## Commands

```sh
pnpm install
pnpm dev      # start dev server
pnpm test     # run solver unit tests (18 cases)
pnpm build    # production build
```

## Solver Verification

The solver is verified against analytical solutions for 15+ standard cases
(simply supported, cantilever, overhanging, propped cantilever, continuous
two-span, internal hinge, spring support, combined loading). See
`src/solver/__tests__/solver.test.ts`.

## License

See `LICENSE`.

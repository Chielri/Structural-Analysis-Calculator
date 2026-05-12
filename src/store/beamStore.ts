import { create } from 'zustand';
import type {
  AnalysisResults,
  BeamModel,
  ConcreteDeflectionInput,
  ConcreteDesignInput,
  Load,
  Support,
  Hinge,
} from '../solver/types';
import { solve, validate } from '../solver';
import { makeId } from '../solver/utils';
import { DEFAULT_MATERIAL } from '../data/materialLibrary';
import { DEFAULT_SECTION } from '../data/sectionLibrary';
import { DEFAULT_CONCRETE_INPUT } from '../solver/ec2Deflection';
import { DEFAULT_CONCRETE_DESIGN } from '../solver/ec2Design';
import type { UnitSystem } from '../utils/units';

export type Theme = 'dark' | 'light';
export type ResultTab = 'reactions' | 'sfd' | 'bmd' | 'deflection' | 'stress' | 'ec2';

export interface BeamState {
  model: BeamModel;
  results: AnalysisResults | null;
  errors: string[];
  unitSystem: UnitSystem;
  theme: Theme;
  resultTab: ResultTab;
  selectedElement: { kind: 'support' | 'load' | 'hinge'; id: string } | null;
  history: BeamModel[];
  future: BeamModel[];

  // Actions
  setModel(m: BeamModel, recordHistory?: boolean): void;
  setBeamLength(length: number): void;

  addSupport(s?: Partial<Support>): void;
  updateSupport(id: string, patch: Partial<Support>): void;
  removeSupport(id: string): void;

  addLoad(l: Load): void;
  updateLoad(id: string, patch: Partial<Load>): void;
  removeLoad(id: string): void;

  addHinge(h?: Partial<Hinge>): void;
  updateHinge(id: string, patch: Partial<Hinge>): void;
  removeHinge(id: string): void;

  setSection(section: BeamModel['section']): void;
  setMaterial(material: BeamModel['material']): void;
  setConcreteInput(patch: Partial<ConcreteDeflectionInput>): void;
  setConcreteDesign(patch: Partial<ConcreteDesignInput>): void;
  applyDesignedRebar(): void;
  toggleSelfWeight(): void;

  runSolve(): void;

  setUnitSystem(sys: UnitSystem): void;
  setTheme(t: Theme): void;
  setResultTab(t: ResultTab): void;
  setSelectedElement(sel: BeamState['selectedElement']): void;

  undo(): void;
  redo(): void;

  saveJSON(): string;
  loadJSON(json: string): void;
  loadPreset(name: PresetName): void;
}

const DEFAULT_MODEL: BeamModel = {
  length: 10,
  supports: [
    { id: 's1', type: 'pin', position: 0 },
    { id: 's2', type: 'roller', position: 10 },
  ],
  loads: [
    {
      kind: 'distributed',
      id: 'd1',
      startPos: 0,
      endPos: 10,
      startMag: 5,
      endMag: 5,
    },
  ],
  hinges: [],
  section: DEFAULT_SECTION,
  material: DEFAULT_MATERIAL,
  selfWeight: false,
};

export type PresetName =
  | 'ss_udl'
  | 'cantilever_tip'
  | 'ss_two_point'
  | 'overhanging'
  | 'combined';

export const PRESETS: Record<PresetName, { label: string; model: BeamModel }> = {
  ss_udl: {
    label: 'Simply Supported + UDL',
    model: {
      length: 10,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: 10 },
      ],
      loads: [
        {
          kind: 'distributed',
          id: 'd1',
          startPos: 0,
          endPos: 10,
          startMag: 5,
          endMag: 5,
        },
      ],
      hinges: [],
      section: DEFAULT_SECTION,
      material: DEFAULT_MATERIAL,
      selfWeight: false,
    },
  },
  cantilever_tip: {
    label: 'Cantilever + Tip Load',
    model: {
      length: 6,
      supports: [{ id: 's1', type: 'fixed', position: 0 }],
      loads: [{ kind: 'point', id: 'p1', position: 6, magnitude: 10 }],
      hinges: [],
      section: DEFAULT_SECTION,
      material: DEFAULT_MATERIAL,
      selfWeight: false,
    },
  },
  ss_two_point: {
    label: 'Simply Supported + Two Point Loads',
    model: {
      length: 8,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: 8 },
      ],
      loads: [
        { kind: 'point', id: 'p1', position: 2, magnitude: 15 },
        { kind: 'point', id: 'p2', position: 6, magnitude: 10 },
      ],
      hinges: [],
      section: DEFAULT_SECTION,
      material: DEFAULT_MATERIAL,
      selfWeight: false,
    },
  },
  overhanging: {
    label: 'Overhanging Beam',
    model: {
      length: 12,
      supports: [
        { id: 's1', type: 'pin', position: 2 },
        { id: 's2', type: 'roller', position: 10 },
      ],
      loads: [{ kind: 'point', id: 'p1', position: 12, magnitude: 8 }],
      hinges: [],
      section: DEFAULT_SECTION,
      material: DEFAULT_MATERIAL,
      selfWeight: false,
    },
  },
  combined: {
    label: 'Combined Loading',
    model: {
      length: 10,
      supports: [
        { id: 's1', type: 'pin', position: 0 },
        { id: 's2', type: 'roller', position: 10 },
      ],
      loads: [
        { kind: 'distributed', id: 'd1', startPos: 0, endPos: 10, startMag: 4, endMag: 4 },
        { kind: 'point', id: 'p1', position: 4, magnitude: 12 },
        { kind: 'moment', id: 'm1', position: 7, magnitude: 8 },
      ],
      hinges: [],
      section: DEFAULT_SECTION,
      material: DEFAULT_MATERIAL,
      selfWeight: false,
    },
  },
};

const HISTORY_LIMIT = 50;

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

export const useBeamStore = create<BeamState>((set, get) => ({
  model: deepClone(DEFAULT_MODEL),
  results: null,
  errors: [],
  unitSystem: 'SI',
  theme: 'dark',
  resultTab: 'reactions',
  selectedElement: null,
  history: [],
  future: [],

  setModel(m, recordHistory = true) {
    if (recordHistory) {
      set((s) => ({
        history: [...s.history.slice(-HISTORY_LIMIT + 1), s.model],
        future: [],
      }));
    }
    set({ model: m });
    get().runSolve();
  },

  setBeamLength(length) {
    const m = deepClone(get().model);
    m.length = Math.max(0.001, length);
    get().setModel(m);
  },

  addSupport(s) {
    const m = deepClone(get().model);
    const id = makeId('s');
    m.supports.push({ id, type: 'roller', position: m.length / 2, ...s } as Support);
    get().setModel(m);
  },
  updateSupport(id, patch) {
    const m = deepClone(get().model);
    const idx = m.supports.findIndex((s) => s.id === id);
    if (idx >= 0) m.supports[idx] = { ...m.supports[idx], ...patch } as Support;
    get().setModel(m);
  },
  removeSupport(id) {
    const m = deepClone(get().model);
    m.supports = m.supports.filter((s) => s.id !== id);
    get().setModel(m);
  },

  addLoad(l) {
    const m = deepClone(get().model);
    m.loads.push(l);
    get().setModel(m);
  },
  updateLoad(id, patch) {
    const m = deepClone(get().model);
    const idx = m.loads.findIndex((l) => l.id === id);
    if (idx >= 0) m.loads[idx] = { ...m.loads[idx], ...patch } as Load;
    get().setModel(m);
  },
  removeLoad(id) {
    const m = deepClone(get().model);
    m.loads = m.loads.filter((l) => l.id !== id);
    get().setModel(m);
  },

  addHinge(h) {
    const m = deepClone(get().model);
    const id = makeId('h');
    m.hinges.push({ id, position: m.length / 2, ...h });
    get().setModel(m);
  },
  updateHinge(id, patch) {
    const m = deepClone(get().model);
    const idx = m.hinges.findIndex((x) => x.id === id);
    if (idx >= 0) m.hinges[idx] = { ...m.hinges[idx], ...patch };
    get().setModel(m);
  },
  removeHinge(id) {
    const m = deepClone(get().model);
    m.hinges = m.hinges.filter((x) => x.id !== id);
    get().setModel(m);
  },

  setSection(section) {
    const m = deepClone(get().model);
    m.section = section;
    get().setModel(m);
  },
  setMaterial(material) {
    const m = deepClone(get().model);
    m.material = material;
    if (material.isConcrete) {
      if (!m.concrete) m.concrete = { ...DEFAULT_CONCRETE_INPUT };
      if (!m.concreteDesign) m.concreteDesign = { ...DEFAULT_CONCRETE_DESIGN };
    } else {
      delete m.concrete;
      delete m.concreteDesign;
    }
    get().setModel(m);
  },
  setConcreteInput(patch) {
    const m = deepClone(get().model);
    const base = m.concrete ?? { ...DEFAULT_CONCRETE_INPUT };
    m.concrete = { ...base, ...patch };
    get().setModel(m);
  },
  setConcreteDesign(patch) {
    const m = deepClone(get().model);
    const base = m.concreteDesign ?? { ...DEFAULT_CONCRETE_DESIGN };
    m.concreteDesign = { ...base, ...patch };
    get().setModel(m);
  },
  applyDesignedRebar() {
    const r = get().results;
    if (!r?.ec2Design) return;
    const m = deepClone(get().model);
    const base = m.concrete ?? { ...DEFAULT_CONCRETE_INPUT };
    m.concrete = {
      ...base,
      As: Math.ceil(r.ec2Design.As_req),
      As_prime: Math.ceil(r.ec2Design.As_prime_req),
    };
    get().setModel(m);
  },
  toggleSelfWeight() {
    const m = deepClone(get().model);
    m.selfWeight = !m.selfWeight;
    get().setModel(m);
  },

  runSolve() {
    const model = get().model;
    const errors = validate(model);
    if (errors.length) {
      set({ errors, results: null });
      return;
    }
    try {
      const results = solve(model);
      set({ results, errors: [] });
    } catch (e) {
      set({ errors: [(e as Error).message], results: null });
    }
  },

  setUnitSystem(sys) {
    set({ unitSystem: sys });
  },
  setTheme(t) {
    set({ theme: t });
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', t === 'light');
    }
  },
  setResultTab(t) {
    set({ resultTab: t });
  },
  setSelectedElement(sel) {
    set({ selectedElement: sel });
  },

  undo() {
    const { history, model, future } = get();
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    set({
      history: history.slice(0, -1),
      future: [model, ...future].slice(0, HISTORY_LIMIT),
      model: prev,
    });
    get().runSolve();
  },
  redo() {
    const { future, model, history } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      future: future.slice(1),
      history: [...history, model].slice(-HISTORY_LIMIT),
      model: next,
    });
    get().runSolve();
  },

  saveJSON() {
    return JSON.stringify(get().model, null, 2);
  },
  loadJSON(json) {
    try {
      const m = JSON.parse(json) as BeamModel;
      get().setModel(m);
    } catch (e) {
      set({ errors: ['Invalid beam JSON: ' + (e as Error).message] });
    }
  },
  loadPreset(name) {
    const p = PRESETS[name];
    if (p) get().setModel(deepClone(p.model));
  },
}));

// Initial solve
useBeamStore.getState().runSolve();

import { useState } from 'react';
import { useBeamStore } from '../../store/beamStore';
import {
  ALL_SECTIONS,
  WIDE_FLANGE,
  CHANNELS,
  STANDARD_RECTANGLES,
  STANDARD_CIRCLES,
  rectangleSection,
  circleSection,
  pipeSection,
} from '../../data/sectionLibrary';
import { MATERIALS } from '../../data/materialLibrary';
import { Field, NumberInput, Select } from '../ui/Field';
import { fromSI_I, labels, toSI_I } from '../../utils/units';

type Tab = 'library' | 'custom' | 'rectangle' | 'circle' | 'pipe';

export function SectionInput() {
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  const section = useBeamStore((s) => s.model.section);
  const material = useBeamStore((s) => s.model.material);
  const setSection = useBeamStore((s) => s.setSection);
  const setMaterial = useBeamStore((s) => s.setMaterial);
  const [tab, setTab] = useState<Tab>('library');
  const [rect, setRect] = useState({ b: 200, h: 400 });
  const [circ, setCirc] = useState({ d: 200 });
  const [pipe, setPipe] = useState({ od: 200, id: 180 });

  return (
    <div className="space-y-3">
      <Field label="Material">
        <Select
          value={material.name}
          onChange={(name) => {
            const m = MATERIALS.find((m) => m.name === name);
            if (m) setMaterial(m);
          }}
          options={MATERIALS.map((m) => ({ value: m.name, label: m.name }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
        <div>E: <span className="num text-slate-200">{material.E.toLocaleString()}</span> {lbl.E}</div>
        <div>
          {material.fy ? (<>fy: <span className="num text-slate-200">{material.fy}</span> {lbl.stress}</>) : null}
        </div>
      </div>

      <div>
        <div className="field-label">Section Source</div>
        <div className="grid grid-cols-5 gap-1">
          {(['library', 'custom', 'rectangle', 'circle', 'pipe'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`btn text-xs ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            >
              {t === 'library' ? 'Lib' : t.charAt(0).toUpperCase() + t.slice(1, 4)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'library' && (
        <Field label="Section">
          <Select
            value={section.name ?? ''}
            onChange={(name) => {
              const s = ALL_SECTIONS.find((x) => x.name === name);
              if (s) setSection(s);
            }}
            options={[
              ...WIDE_FLANGE.map((s) => ({ value: s.name!, label: `W: ${s.name}` })),
              ...CHANNELS.map((s) => ({ value: s.name!, label: `C: ${s.name}` })),
              ...STANDARD_RECTANGLES.map((s) => ({ value: s.name!, label: s.name! })),
              ...STANDARD_CIRCLES.map((s) => ({ value: s.name!, label: s.name! })),
            ]}
          />
        </Field>
      )}

      {tab === 'custom' && (
        <div className="space-y-2">
          <Field label="Moment of Inertia I" unit={lbl.I}>
            <NumberInput
              value={fromSI_I(section.I, sys)}
              onChange={(v) => setSection({ ...section, I: toSI_I(v, sys), name: 'custom' })}
            />
          </Field>
          <Field label="Area A" unit={`${lbl.length}²`}>
            <NumberInput
              value={section.A ?? 0}
              onChange={(v) => setSection({ ...section, A: v, name: 'custom' })}
            />
          </Field>
          <Field label="y top" unit={lbl.length}>
            <NumberInput
              value={section.yTop ?? 0}
              onChange={(v) => setSection({ ...section, yTop: v, name: 'custom' })}
            />
          </Field>
          <Field label="y bot" unit={lbl.length}>
            <NumberInput
              value={section.yBot ?? 0}
              onChange={(v) => setSection({ ...section, yBot: v, name: 'custom' })}
            />
          </Field>
        </div>
      )}

      {tab === 'rectangle' && (
        <div className="space-y-2">
          <Field label="Width b" unit="mm">
            <NumberInput value={rect.b} onChange={(v) => setRect({ ...rect, b: v })} />
          </Field>
          <Field label="Height h" unit="mm">
            <NumberInput value={rect.h} onChange={(v) => setRect({ ...rect, h: v })} />
          </Field>
          <button
            className="btn btn-primary w-full"
            onClick={() => setSection(rectangleSection(rect.b, rect.h))}
          >
            Apply
          </button>
        </div>
      )}

      {tab === 'circle' && (
        <div className="space-y-2">
          <Field label="Diameter" unit="mm">
            <NumberInput value={circ.d} onChange={(v) => setCirc({ ...circ, d: v })} />
          </Field>
          <button
            className="btn btn-primary w-full"
            onClick={() => setSection(circleSection(circ.d))}
          >
            Apply
          </button>
        </div>
      )}

      {tab === 'pipe' && (
        <div className="space-y-2">
          <Field label="Outer Ø" unit="mm">
            <NumberInput value={pipe.od} onChange={(v) => setPipe({ ...pipe, od: v })} />
          </Field>
          <Field label="Inner Ø" unit="mm">
            <NumberInput value={pipe.id} onChange={(v) => setPipe({ ...pipe, id: v })} />
          </Field>
          <button
            className="btn btn-primary w-full"
            onClick={() => setSection(pipeSection(pipe.od, pipe.id))}
          >
            Apply
          </button>
        </div>
      )}

      <div className="text-xs text-slate-400 mt-2 grid grid-cols-2 gap-1 font-mono">
        <div>Current: {section.name ?? '—'}</div>
        <div></div>
        <div>I = {fromSI_I(section.I, sys).toExponential(3)} {lbl.I}</div>
        <div>A = {(section.A ?? 0).toExponential(3)} {lbl.length}²</div>
      </div>
    </div>
  );
}

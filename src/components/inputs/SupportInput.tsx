import { useBeamStore } from '../../store/beamStore';
import type { SupportType } from '../../solver/types';
import { fromSI_length, labels, toSI_length } from '../../utils/units';
import { Field, NumberInput, Select } from '../ui/Field';

const SUPPORT_TYPES: { value: SupportType; label: string }[] = [
  { value: 'pin', label: 'Pin' },
  { value: 'roller', label: 'Roller' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'spring', label: 'Spring' },
];

export function SupportInput() {
  const supports = useBeamStore((s) => s.model.supports);
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  const addSupport = useBeamStore((s) => s.addSupport);
  const updateSupport = useBeamStore((s) => s.updateSupport);
  const removeSupport = useBeamStore((s) => s.removeSupport);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Supports ({supports.length})</h3>
        <button className="btn btn-ghost text-xs" onClick={() => addSupport()}>
          + Add Support
        </button>
      </div>
      <div className="space-y-2">
        {supports.map((s) => (
          <div key={s.id} className="panel p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Type">
                <Select
                  value={s.type}
                  onChange={(v) => updateSupport(s.id, { type: v })}
                  options={SUPPORT_TYPES}
                />
              </Field>
              <Field label="Position" unit={lbl.length}>
                <NumberInput
                  value={fromSI_length(s.position, sys)}
                  onChange={(v) => updateSupport(s.id, { position: toSI_length(v, sys) })}
                />
              </Field>
            </div>
            {s.type === 'spring' && (
              <Field label="Stiffness" unit={`${lbl.force}/${lbl.length}`}>
                <NumberInput
                  value={s.springStiffness ?? 0}
                  onChange={(v) => updateSupport(s.id, { springStiffness: v })}
                />
              </Field>
            )}
            <Field label="Settlement" unit={lbl.length}>
              <NumberInput
                value={s.settlement ?? 0}
                onChange={(v) => updateSupport(s.id, { settlement: v })}
              />
            </Field>
            <button
              className="btn btn-danger text-xs w-full"
              onClick={() => removeSupport(s.id)}
            >
              Delete
            </button>
          </div>
        ))}
        {supports.length === 0 && (
          <div className="text-xs text-slate-400 italic">No supports yet.</div>
        )}
      </div>
    </div>
  );
}

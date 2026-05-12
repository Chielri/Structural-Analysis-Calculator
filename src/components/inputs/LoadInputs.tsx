import { useBeamStore } from '../../store/beamStore';
import {
  fromSI_distLoad,
  fromSI_force,
  fromSI_length,
  fromSI_moment,
  labels,
  toSI_distLoad,
  toSI_force,
  toSI_length,
  toSI_moment,
} from '../../utils/units';
import { Field, NumberInput } from '../ui/Field';
import { makeId } from '../../solver/utils';

export function PointLoadInput() {
  const allLoads = useBeamStore((s) => s.model.loads);
  const loads = allLoads.filter((l) => l.kind === 'point');
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  const addLoad = useBeamStore((s) => s.addLoad);
  const updateLoad = useBeamStore((s) => s.updateLoad);
  const removeLoad = useBeamStore((s) => s.removeLoad);
  const beamLength = useBeamStore((s) => s.model.length);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Point Loads ({loads.length})</h3>
        <button
          className="btn btn-ghost text-xs"
          onClick={() =>
            addLoad({ kind: 'point', id: makeId('p'), position: beamLength / 2, magnitude: 10 })
          }
        >
          + Add Point Load
        </button>
      </div>
      <div className="space-y-2">
        {loads.map((l) => (
          <div key={l.id} className="panel p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Position" unit={lbl.length}>
                <NumberInput
                  value={fromSI_length(l.position, sys)}
                  onChange={(v) => updateLoad(l.id, { position: toSI_length(v, sys) })}
                />
              </Field>
              <Field label="Magnitude" unit={lbl.force}>
                <NumberInput
                  value={fromSI_force(l.magnitude, sys)}
                  onChange={(v) => updateLoad(l.id, { magnitude: toSI_force(v, sys) })}
                />
              </Field>
            </div>
            <Field label="Angle (from vertical)" unit="°">
              <NumberInput
                value={l.angle ?? 0}
                onChange={(v) => updateLoad(l.id, { angle: v })}
              />
            </Field>
            <button className="btn btn-danger text-xs w-full" onClick={() => removeLoad(l.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DistLoadInput() {
  const allLoads = useBeamStore((s) => s.model.loads);
  const loads = allLoads.filter((l) => l.kind === 'distributed');
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  const addLoad = useBeamStore((s) => s.addLoad);
  const updateLoad = useBeamStore((s) => s.updateLoad);
  const removeLoad = useBeamStore((s) => s.removeLoad);
  const beamLength = useBeamStore((s) => s.model.length);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Distributed Loads ({loads.length})</h3>
        <button
          className="btn btn-ghost text-xs"
          onClick={() =>
            addLoad({
              kind: 'distributed',
              id: makeId('d'),
              startPos: 0,
              endPos: beamLength,
              startMag: 5,
              endMag: 5,
            })
          }
        >
          + Add Dist. Load
        </button>
      </div>
      <div className="space-y-2">
        {loads.map((l) => (
          <div key={l.id} className="panel p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start pos" unit={lbl.length}>
                <NumberInput
                  value={fromSI_length(l.startPos, sys)}
                  onChange={(v) => updateLoad(l.id, { startPos: toSI_length(v, sys) })}
                />
              </Field>
              <Field label="End pos" unit={lbl.length}>
                <NumberInput
                  value={fromSI_length(l.endPos, sys)}
                  onChange={(v) => updateLoad(l.id, { endPos: toSI_length(v, sys) })}
                />
              </Field>
              <Field label="Start magnitude" unit={lbl.distLoad}>
                <NumberInput
                  value={fromSI_distLoad(l.startMag, sys)}
                  onChange={(v) => updateLoad(l.id, { startMag: toSI_distLoad(v, sys) })}
                />
              </Field>
              <Field label="End magnitude" unit={lbl.distLoad}>
                <NumberInput
                  value={fromSI_distLoad(l.endMag, sys)}
                  onChange={(v) => updateLoad(l.id, { endMag: toSI_distLoad(v, sys) })}
                />
              </Field>
            </div>
            <button className="btn btn-danger text-xs w-full" onClick={() => removeLoad(l.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MomentInput() {
  const allLoads = useBeamStore((s) => s.model.loads);
  const loads = allLoads.filter((l) => l.kind === 'moment');
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  const addLoad = useBeamStore((s) => s.addLoad);
  const updateLoad = useBeamStore((s) => s.updateLoad);
  const removeLoad = useBeamStore((s) => s.removeLoad);
  const beamLength = useBeamStore((s) => s.model.length);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Applied Moments ({loads.length})</h3>
        <button
          className="btn btn-ghost text-xs"
          onClick={() =>
            addLoad({
              kind: 'moment',
              id: makeId('m'),
              position: beamLength / 2,
              magnitude: 10,
            })
          }
        >
          + Add Moment
        </button>
      </div>
      <div className="space-y-2">
        {loads.map((l) => (
          <div key={l.id} className="panel p-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Position" unit={lbl.length}>
                <NumberInput
                  value={fromSI_length(l.position, sys)}
                  onChange={(v) => updateLoad(l.id, { position: toSI_length(v, sys) })}
                />
              </Field>
              <Field label="Magnitude (CW+)" unit={lbl.moment}>
                <NumberInput
                  value={fromSI_moment(l.magnitude, sys)}
                  onChange={(v) => updateLoad(l.id, { magnitude: toSI_moment(v, sys) })}
                />
              </Field>
            </div>
            <button className="btn btn-danger text-xs w-full" onClick={() => removeLoad(l.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HingeInput() {
  const hinges = useBeamStore((s) => s.model.hinges);
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  const addHinge = useBeamStore((s) => s.addHinge);
  const updateHinge = useBeamStore((s) => s.updateHinge);
  const removeHinge = useBeamStore((s) => s.removeHinge);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold">Internal Hinges ({hinges.length})</h3>
        <button className="btn btn-ghost text-xs" onClick={() => addHinge()}>
          + Add Hinge
        </button>
      </div>
      <div className="space-y-2">
        {hinges.map((h) => (
          <div key={h.id} className="panel p-2 space-y-2">
            <Field label="Position" unit={lbl.length}>
              <NumberInput
                value={fromSI_length(h.position, sys)}
                onChange={(v) => updateHinge(h.id, { position: toSI_length(v, sys) })}
              />
            </Field>
            <button className="btn btn-danger text-xs w-full" onClick={() => removeHinge(h.id)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

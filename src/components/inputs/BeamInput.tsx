import { useBeamStore } from '../../store/beamStore';
import { fromSI_length, labels, toSI_length } from '../../utils/units';
import { Field, NumberInput } from '../ui/Field';

export function BeamInput() {
  const length = useBeamStore((s) => s.model.length);
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  const setBeamLength = useBeamStore((s) => s.setBeamLength);
  const selfWeight = useBeamStore((s) => s.model.selfWeight ?? false);
  const toggleSelfWeight = useBeamStore((s) => s.toggleSelfWeight);

  return (
    <div className="space-y-3">
      <Field label="Beam Length" unit={lbl.length}>
        <NumberInput
          value={fromSI_length(length, sys)}
          onChange={(v) => setBeamLength(toSI_length(v, sys))}
          min={0.01}
        />
      </Field>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={selfWeight}
          onChange={toggleSelfWeight}
          className="accent-accent"
        />
        <span className="text-sm">Include self-weight</span>
      </label>
    </div>
  );
}

import { useBeamStore } from '../../store/beamStore';
import { DEFAULT_CONCRETE_DESIGN } from '../../solver/ec2Design';
import { Field, NumberInput, Select } from '../ui/Field';

/**
 * EC2 (SS EN 1992-1-1 Cl. 6.1) flexural-design inputs.
 * Only rendered when a concrete material is selected.
 */
export function ConcreteDesignInput() {
  const material = useBeamStore((s) => s.model.material);
  const cfg = useBeamStore((s) => s.model.concreteDesign) ?? DEFAULT_CONCRETE_DESIGN;
  const set = useBeamStore((s) => s.setConcreteDesign);

  if (!material.isConcrete) return null;

  const usingAuto = !cfg.M_Ed || cfg.M_Ed <= 0;

  return (
    <div className="panel p-3 mt-3 space-y-2 border border-sky-700/40">
      <div className="text-xs font-semibold text-sky-300 uppercase tracking-wide">
        EC2 6.1 — RC Flexural Design
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="M_Ed source">
          <Select<'auto' | 'manual'>
            value={usingAuto ? 'auto' : 'manual'}
            onChange={(v) => set({ M_Ed: v === 'auto' ? 0 : 100e6 })}
            options={[
              { value: 'auto', label: 'Auto (peak |M| × ULS)' },
              { value: 'manual', label: 'Manual (kN·m)' },
            ]}
          />
        </Field>
        {usingAuto ? (
          <Field label="ULS factor" unit="—">
            <NumberInput
              value={cfg.ulsFactor}
              min={1}
              onChange={(v) => set({ ulsFactor: v })}
            />
          </Field>
        ) : (
          <Field label="M_Ed" unit="kN·m">
            <NumberInput
              value={(cfg.M_Ed ?? 0) / 1e6}
              min={0}
              onChange={(v) => set({ M_Ed: v * 1e6 })}
            />
          </Field>
        )}

        <Field label="fyk (steel)" unit="MPa">
          <NumberInput value={cfg.fyk} min={0} onChange={(v) => set({ fyk: v })} />
        </Field>
        <Field label="αcc" unit="—">
          <NumberInput
            value={cfg.alpha_cc}
            min={0}
            max={1}
            onChange={(v) => set({ alpha_cc: v })}
          />
        </Field>
        <Field label="γc" unit="—">
          <NumberInput
            value={cfg.gamma_c}
            min={1}
            onChange={(v) => set({ gamma_c: v })}
          />
        </Field>
        <Field label="γs" unit="—">
          <NumberInput
            value={cfg.gamma_s}
            min={1}
            onChange={(v) => set({ gamma_s: v })}
          />
        </Field>
        <Field label="δ (redistribution)" unit="—">
          <NumberInput
            value={cfg.delta}
            min={0.7}
            max={1}
            onChange={(v) => set({ delta: v })}
          />
        </Field>
      </div>

      <div className="text-[11px] text-slate-400 leading-snug pt-1 border-t border-slate-700">
        Typical: fyk = 500, αcc = 1.0 (or 0.85 NA-dependent), γc = 1.5, γs = 1.15,
        δ = 1.0 (no redistribution). K_lim depends on δ; design uses the
        rectangular stress block (λ = 0.8, η = 1.0, fck ≤ 50 MPa).
      </div>
    </div>
  );
}

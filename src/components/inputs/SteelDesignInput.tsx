import { useBeamStore } from '../../store/beamStore';
import { DEFAULT_STEEL_DESIGN } from '../../solver/ec3Design';
import { Field, NumberInput, Select } from '../ui/Field';

/**
 * EC3 steel I/H beam design inputs.
 * Rendered when a steel material is paired with an I-section that has the
 * extended `iSection` properties (e.g. the UB library entries).
 */
export function SteelDesignInput() {
  const material = useBeamStore((s) => s.model.material);
  const section = useBeamStore((s) => s.model.section);
  const cfg = useBeamStore((s) => s.model.steelDesign) ?? DEFAULT_STEEL_DESIGN;
  const set = useBeamStore((s) => s.setSteelDesign);

  if (material.isConcrete) return null;
  if (!section.iSection) {
    if (material.fy && material.fy > 0) {
      return (
        <div className="panel p-3 mt-3 text-xs text-amber-300 border border-amber-700/40">
          EC3 design requires a UB section (full geometry). Pick one from the
          library (UB 457×191×82 etc.) to enable.
        </div>
      );
    }
    return null;
  }
  if (!material.fy || material.fy <= 0) return null;

  const M_auto = !cfg.M_Ed_kNm || cfg.M_Ed_kNm <= 0;
  const V_auto = !cfg.V_Ed_kN || cfg.V_Ed_kN <= 0;

  return (
    <div className="panel p-3 mt-3 space-y-3 border border-emerald-700/40">
      <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wide">
        EC3 — Steel I/H Beam Design
      </div>

      <Group title="Demands">
        <div className="grid grid-cols-2 gap-2">
          <Field label="M_Ed">
            <Select<'auto' | 'manual'>
              value={M_auto ? 'auto' : 'manual'}
              onChange={(v) => set({ M_Ed_kNm: v === 'auto' ? 0 : 100 })}
              options={[
                { value: 'auto', label: 'Auto × ULS factor' },
                { value: 'manual', label: 'Manual (kN·m)' },
              ]}
            />
          </Field>
          {M_auto ? (
            <Field label="ULS factor" unit="—">
              <NumberInput
                value={cfg.ulsFactor} min={1}
                onChange={(v) => set({ ulsFactor: v })}
              />
            </Field>
          ) : (
            <Field label="M_Ed" unit="kN·m">
              <NumberInput
                value={cfg.M_Ed_kNm ?? 0} min={0}
                onChange={(v) => set({ M_Ed_kNm: v })}
              />
            </Field>
          )}
          <Field label="V_Ed">
            <Select<'auto' | 'manual'>
              value={V_auto ? 'auto' : 'manual'}
              onChange={(v) => set({ V_Ed_kN: v === 'auto' ? 0 : 100 })}
              options={[
                { value: 'auto', label: 'Auto × ULS factor' },
                { value: 'manual', label: 'Manual (kN)' },
              ]}
            />
          </Field>
          {V_auto ? <div /> : (
            <Field label="V_Ed" unit="kN">
              <NumberInput
                value={cfg.V_Ed_kN ?? 0} min={0}
                onChange={(v) => set({ V_Ed_kN: v })}
              />
            </Field>
          )}
        </div>
      </Group>

      <Group title="Partial factors">
        <div className="grid grid-cols-3 gap-2">
          <Field label="γ_M0" unit="—">
            <NumberInput
              value={cfg.gamma_M0} min={0.5}
              onChange={(v) => set({ gamma_M0: v })}
            />
          </Field>
          <Field label="γ_M1" unit="—">
            <NumberInput
              value={cfg.gamma_M1} min={0.5}
              onChange={(v) => set({ gamma_M1: v })}
            />
          </Field>
          <Field label="γ_M2" unit="—">
            <NumberInput
              value={cfg.gamma_M2} min={0.5}
              onChange={(v) => set({ gamma_M2: v })}
            />
          </Field>
        </div>
      </Group>

      <Group title="LTB (§6.3.2)">
        <div className="grid grid-cols-2 gap-2">
          <Field label="LTB check">
            <Select<'on' | 'off'>
              value={cfg.ltbCheck ? 'on' : 'off'}
              onChange={(v) => set({ ltbCheck: v === 'on' })}
              options={[
                { value: 'on', label: 'Run' },
                { value: 'off', label: 'Skip (full restraint)' },
              ]}
            />
          </Field>
          <Field label="L (unrestrained)" unit="m">
            <NumberInput
              value={cfg.L_unrestrained_m} min={0} step={0.1}
              onChange={(v) => set({ L_unrestrained_m: v })}
            />
          </Field>
          <Field label="C1 (NCCI SN003)" unit="—">
            <NumberInput
              value={cfg.C1} min={0.5} max={3}
              onChange={(v) => set({ C1: v })}
            />
          </Field>
          <Field label="Method">
            <Select<'rolled' | 'general'>
              value={cfg.ltbMethod}
              onChange={(v) => set({ ltbMethod: v })}
              options={[
                { value: 'rolled', label: 'Rolled (eq 6.57)' },
                { value: 'general', label: 'General (eq 6.56)' },
              ]}
            />
          </Field>
          <Field label="λ̄LT,0" unit="—">
            <NumberInput
              value={cfg.lambdaLT0} min={0} max={1}
              onChange={(v) => set({ lambdaLT0: v })}
            />
          </Field>
          <Field label="β" unit="—">
            <NumberInput
              value={cfg.beta_ltb} min={0} max={1}
              onChange={(v) => set({ beta_ltb: v })}
            />
          </Field>
          <Field label="kc (mod)" unit="—">
            <NumberInput
              value={cfg.kc} min={0.3} max={1}
              onChange={(v) => set({ kc: v })}
            />
          </Field>
          <Field label="η (shear)" unit="—">
            <NumberInput
              value={cfg.eta_shear} min={0.5} max={1.2}
              onChange={(v) => set({ eta_shear: v })}
            />
          </Field>
        </div>
      </Group>

      <div className="text-[11px] text-slate-400 leading-snug pt-1 border-t border-slate-700">
        SS EN 1993-1-1:2010. C1 ≈ 1.00 uniform M, 1.13 SS-UDL, 1.36 point @ mid,
        1.77 triangular, 2.75 double curvature. Verify SG NA for γM values.
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">{title}</div>
      {children}
    </div>
  );
}

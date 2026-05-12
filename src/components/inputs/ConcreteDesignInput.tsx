import { useBeamStore } from '../../store/beamStore';
import { DEFAULT_CONCRETE_DESIGN } from '../../solver/ec2Design';
import { Field, NumberInput, Select } from '../ui/Field';

/**
 * EC2 + SG NA full design inputs.
 * Only rendered when a concrete material is selected.
 */
export function ConcreteDesignInput() {
  const material = useBeamStore((s) => s.model.material);
  const cfg = useBeamStore((s) => s.model.concreteDesign) ?? DEFAULT_CONCRETE_DESIGN;
  const set = useBeamStore((s) => s.setConcreteDesign);

  if (!material.isConcrete) return null;

  const M_auto = !cfg.M_Ed_kNm || cfg.M_Ed_kNm <= 0;
  const V_auto = !cfg.V_Ed_kN || cfg.V_Ed_kN <= 0;
  const Mqp_auto = !cfg.M_qp_kNm || cfg.M_qp_kNm <= 0;

  return (
    <div className="panel p-3 mt-3 space-y-3 border border-sky-700/40">
      <div className="text-xs font-semibold text-sky-300 uppercase tracking-wide">
        EC2 + SG NA — RC Beam Design
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
                value={cfg.ulsFactor}
                min={1}
                onChange={(v) => set({ ulsFactor: v })}
              />
            </Field>
          ) : (
            <Field label="M_Ed" unit="kN·m">
              <NumberInput
                value={cfg.M_Ed_kNm ?? 0}
                min={0}
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
          {V_auto ? (
            <div />
          ) : (
            <Field label="V_Ed" unit="kN">
              <NumberInput
                value={cfg.V_Ed_kN ?? 0}
                min={0}
                onChange={(v) => set({ V_Ed_kN: v })}
              />
            </Field>
          )}
          <Field label="M_qp (SLS QP)">
            <Select<'auto' | 'manual'>
              value={Mqp_auto ? 'auto' : 'manual'}
              onChange={(v) => set({ M_qp_kNm: v === 'auto' ? 0 : 50 })}
              options={[
                { value: 'auto', label: 'Auto = |M| peak' },
                { value: 'manual', label: 'Manual (kN·m)' },
              ]}
            />
          </Field>
          {!Mqp_auto && (
            <Field label="M_qp" unit="kN·m">
              <NumberInput
                value={cfg.M_qp_kNm ?? 0}
                min={0}
                onChange={(v) => set({ M_qp_kNm: v })}
              />
            </Field>
          )}
        </div>
      </Group>

      <Group title="Materials / NA">
        <div className="grid grid-cols-2 gap-2">
          <Field label="fyk" unit="MPa">
            <NumberInput value={cfg.fyk} min={0} onChange={(v) => set({ fyk: v })} />
          </Field>
          <Field label="δ (redist.)" unit="—">
            <NumberInput
              value={cfg.delta} min={0.7} max={1}
              onChange={(v) => set({ delta: v })}
            />
          </Field>
          <Field label="αcc (SG NA 0.85)" unit="—">
            <NumberInput
              value={cfg.alpha_cc} min={0} max={1}
              onChange={(v) => set({ alpha_cc: v })}
            />
          </Field>
          <Field label="αct" unit="—">
            <NumberInput
              value={cfg.alpha_ct} min={0} max={1}
              onChange={(v) => set({ alpha_ct: v })}
            />
          </Field>
          <Field label="γc" unit="—">
            <NumberInput value={cfg.gamma_c} min={1} onChange={(v) => set({ gamma_c: v })} />
          </Field>
          <Field label="γs" unit="—">
            <NumberInput value={cfg.gamma_s} min={1} onChange={(v) => set({ gamma_s: v })} />
          </Field>
        </div>
      </Group>

      <Group title="Cover &amp; bars">
        <div className="grid grid-cols-2 gap-2">
          <Field label="cnom" unit="mm">
            <NumberInput value={cfg.cnom} min={10} onChange={(v) => set({ cnom: v })} />
          </Field>
          <Field label="φ_bar" unit="mm">
            <NumberInput value={cfg.phi_bar} min={6} onChange={(v) => set({ phi_bar: v })} />
          </Field>
          <Field label="φ_bar′ (comp)" unit="mm">
            <NumberInput value={cfg.phi_bar2} min={6} onChange={(v) => set({ phi_bar2: v })} />
          </Field>
          <Field label="φ_link" unit="mm">
            <NumberInput value={cfg.phi_link} min={6} onChange={(v) => set({ phi_link: v })} />
          </Field>
          <Field label="Bond">
            <Select<'good' | 'poor'>
              value={cfg.bond}
              onChange={(v) => set({ bond: v })}
              options={[
                { value: 'good', label: 'Good (η1 = 1.0)' },
                { value: 'poor', label: 'Poor (η1 = 0.7)' },
              ]}
            />
          </Field>
          <Field label="ρ1 lapped" unit="%">
            <NumberInput
              value={cfg.rho1_pct} min={0} max={100}
              onChange={(v) => set({ rho1_pct: v })}
            />
          </Field>
        </div>
      </Group>

      <Group title="Deflection (l/d) &amp; crack">
        <div className="grid grid-cols-2 gap-2">
          <Field label="K_sys (Tbl NA.5)" unit="—">
            <NumberInput
              value={cfg.K_sys} min={0.4} max={1.5}
              onChange={(v) => set({ K_sys: v })}
            />
          </Field>
          <Field label="As,prov / As,req" unit="—">
            <NumberInput
              value={cfg.As_prov_factor} min={1.0}
              onChange={(v) => set({ As_prov_factor: v })}
            />
          </Field>
          <Field label="w_max" unit="mm">
            <NumberInput
              value={cfg.wmax} min={0.1} max={0.5} step={0.05}
              onChange={(v) => set({ wmax: v })}
            />
          </Field>
          <Field label="kt (SG NA 1.0)" unit="—">
            <NumberInput
              value={cfg.kt} min={0.3} max={1.0} step={0.05}
              onChange={(v) => set({ kt: v })}
            />
          </Field>
        </div>
      </Group>

      <div className="text-[11px] text-slate-400 leading-snug pt-1 border-t border-slate-700">
        Defaults are SG NA-flavoured (αcc = 0.85, kt = 1.0, k3 = 3.4, k4 = 0.425,
        s_t,max = min(0.75d, 600)). K_sys: 1.0 SS, 1.3 end span, 1.5 interior, 0.4 cantilever.
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

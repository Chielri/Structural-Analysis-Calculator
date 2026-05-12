import { useBeamStore } from '../../store/beamStore';
import { DEFAULT_CONCRETE_INPUT } from '../../solver/ec2Deflection';
import { Field, NumberInput } from '../ui/Field';

/**
 * EC2 (SS EN 1992-1-1 Cl. 7.4.3) concrete-deflection inputs.
 * Only rendered when a concrete material is selected.
 */
export function ConcreteInput() {
  const material = useBeamStore((s) => s.model.material);
  const cfg = useBeamStore((s) => s.model.concrete) ?? DEFAULT_CONCRETE_INPUT;
  const section = useBeamStore((s) => s.model.section);
  const set = useBeamStore((s) => s.setConcreteInput);

  if (!material.isConcrete) return null;

  const b_mm = section.b ? section.b * 1000 : 0;
  const h_mm = section.d ? section.d * 1000 : 0;
  const rectOk = b_mm > 0 && h_mm > 0;

  return (
    <div className="panel p-3 mt-3 space-y-2 border border-amber-700/40">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
          EC2 7.4.3 — RC Deflection
        </div>
        <div className="text-[10px] text-slate-400">fck = {material.fck} MPa</div>
      </div>

      {!rectOk && (
        <div className="text-xs text-amber-400">
          Select a Rectangle section (b × h) so the cracked section can be
          calculated.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label="As (tension)" unit="mm²">
          <NumberInput
            value={cfg.As}
            min={0}
            onChange={(v) => set({ As: v })}
          />
        </Field>
        <Field label="A's (comp.)" unit="mm²">
          <NumberInput
            value={cfg.As_prime}
            min={0}
            onChange={(v) => set({ As_prime: v })}
          />
        </Field>
        <Field label="d (eff. depth)" unit="mm">
          <NumberInput
            value={cfg.d}
            min={0}
            onChange={(v) => set({ d: v })}
          />
        </Field>
        <Field label="d' (comp. depth)" unit="mm">
          <NumberInput
            value={cfg.d_prime}
            min={0}
            onChange={(v) => set({ d_prime: v })}
          />
        </Field>
        <Field label="Es (steel)" unit="MPa">
          <NumberInput
            value={cfg.Es}
            min={0}
            onChange={(v) => set({ Es: v })}
          />
        </Field>
        <Field label="φ(∞,t₀) creep" unit="—">
          <NumberInput
            value={cfg.phi}
            min={0}
            onChange={(v) => set({ phi: v })}
          />
        </Field>
        <Field label="εcs shrinkage" unit="—">
          <NumberInput
            value={cfg.eps_cs}
            min={0}
            onChange={(v) => set({ eps_cs: v })}
          />
        </Field>
        <Field label="β (duration)" unit="—">
          <NumberInput
            value={cfg.beta}
            min={0}
            max={1}
            onChange={(v) => set({ beta: v })}
          />
        </Field>
        <Field label="ψ₂ (QP factor)" unit="—">
          <NumberInput
            value={cfg.psi2}
            min={0}
            max={1}
            onChange={(v) => set({ psi2: v })}
          />
        </Field>
        <Field label="M_inst / M_qp" unit="—">
          <NumberInput
            value={cfg.instMomentRatio ?? 1.0}
            min={0}
            max={1}
            onChange={(v) => set({ instMomentRatio: v })}
          />
        </Field>
      </div>

      <div className="text-[11px] text-slate-400 leading-snug pt-1 border-t border-slate-700">
        β = 0.5 for sustained loads (quasi-permanent), 1.0 for short-term.
        εcs &amp; φ from EC2 Cl. 3.1.4 (typical: φ ≈ 1.5–3, εcs ≈ 2–5 × 10⁻⁴).
      </div>
    </div>
  );
}

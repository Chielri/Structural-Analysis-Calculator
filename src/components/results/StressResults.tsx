import { useBeamStore } from '../../store/beamStore';
import { fromSI_stress, labels } from '../../utils/units';
import { fmt } from '../../utils/formatting';

export function StressResults() {
  const r = useBeamStore((s) => s.results);
  const model = useBeamStore((s) => s.model);
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  if (!r) return null;
  const fy = model.material.fy;
  const u = r.utilization;

  return (
    <div className="space-y-3 font-mono text-sm p-2">
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Max bending stress σ"
          value={r.maxBendingStress !== undefined ? fmt(fromSI_stress(r.maxBendingStress, sys), 3) : '—'}
          unit={lbl.stress}
        />
        <Stat
          label="Max shear stress τ"
          value={r.maxShearStress !== undefined ? fmt(fromSI_stress(r.maxShearStress, sys), 3) : '—'}
          unit={lbl.stress}
        />
        {fy !== undefined && (
          <>
            <Stat label="Yield strength fy" value={fmt(fromSI_stress(fy, sys), 3)} unit={lbl.stress} />
            <Stat
              label="Utilization σ/fy"
              value={u !== undefined ? (u * 100).toFixed(1) + '%' : '—'}
              unit=""
              warn={u !== undefined && u > 1}
            />
          </>
        )}
      </div>
      {u !== undefined && u > 1 && (
        <div className="text-bad text-sm border border-bad/40 bg-red-900/20 px-3 py-2 rounded">
          ⚠ Beam over-stressed (σ &gt; fy). Increase section or reduce loads.
        </div>
      )}
      <div className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-slate-700">
        Stress is computed from the flexure formula σ = M·c / I and the shear formula τ ≈ k·V/A,
        using section extreme fiber distance c = max(y_top, y_bot).
      </div>
    </div>
  );
}

function Stat({ label, value, unit, warn }: { label: string; value: string; unit: string; warn?: boolean }) {
  return (
    <div className="panel p-3">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-lg ${warn ? 'text-bad' : 'text-accent'}`}>
        {value} <span className="text-xs text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

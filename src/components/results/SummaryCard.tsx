import { useBeamStore } from '../../store/beamStore';
import {
  fromSI_deflection_mm,
  fromSI_force,
  fromSI_moment,
  fromSI_stress,
  labels,
} from '../../utils/units';
import { fmt } from '../../utils/formatting';

export function SummaryCard() {
  const r = useBeamStore((s) => s.results);
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  if (!r) return null;
  const items = [
    { label: 'V max', value: fmt(fromSI_force(r.maxShear, sys), 2), unit: lbl.force },
    { label: 'M max', value: fmt(fromSI_moment(r.maxMoment, sys), 2), unit: lbl.moment },
    { label: 'M min', value: fmt(fromSI_moment(r.minMoment, sys), 2), unit: lbl.moment },
    {
      label: 'δ max',
      value: fmt(fromSI_deflection_mm(r.maxDeflection, sys), 2),
      unit: lbl.deflection,
    },
    r.maxBendingStress !== undefined
      ? {
          label: 'σ max',
          value: fmt(fromSI_stress(r.maxBendingStress, sys), 2),
          unit: lbl.stress,
        }
      : null,
    r.utilization !== undefined
      ? {
          label: 'σ/fy',
          value: (r.utilization * 100).toFixed(1) + '%',
          unit: '',
          warn: r.utilization > 1,
        }
      : null,
  ].filter(Boolean) as { label: string; value: string; unit: string; warn?: boolean }[];

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {items.map((it) => (
        <div
          key={it.label}
          className={`panel px-3 py-1.5 flex items-center gap-2 ${it.warn ? 'border-bad' : ''}`}
        >
          <span className="text-slate-400 text-xs">{it.label}</span>
          <span className={`font-mono font-semibold ${it.warn ? 'text-bad' : 'text-accent'}`}>
            {it.value}
          </span>
          <span className="text-slate-500 text-xs">{it.unit}</span>
        </div>
      ))}
      <div className="panel px-3 py-1.5 text-xs text-slate-400">
        {r.determinacy.classification} · solved via {r.determinacy.method}
      </div>
    </div>
  );
}

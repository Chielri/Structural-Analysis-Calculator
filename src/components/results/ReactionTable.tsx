import { useBeamStore } from '../../store/beamStore';
import { fromSI_force, fromSI_length, fromSI_moment, labels } from '../../utils/units';
import { fmt } from '../../utils/formatting';

export function ReactionTable() {
  const reactions = useBeamStore((s) => s.results?.reactions ?? []);
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  if (reactions.length === 0) {
    return <div className="text-sm text-slate-400 italic p-4">No reactions to display.</div>;
  }
  return (
    <table className="w-full font-mono text-sm">
      <thead>
        <tr className="text-left border-b border-slate-700 text-slate-400 text-xs">
          <th className="py-2">Support</th>
          <th>Position ({lbl.length})</th>
          <th>Fy ({lbl.force})</th>
          <th>Fx ({lbl.force})</th>
          <th>Mz ({lbl.moment})</th>
        </tr>
      </thead>
      <tbody>
        {reactions.map((r) => (
          <tr key={r.supportId} className="border-b border-slate-800">
            <td className="py-1.5">{r.supportId}</td>
            <td>{fmt(fromSI_length(r.position, sys), 3)}</td>
            <td className={r.Fy >= 0 ? 'text-good' : 'text-bad'}>
              {fmt(fromSI_force(r.Fy, sys), 3)}
            </td>
            <td>{r.Fx !== undefined ? fmt(fromSI_force(r.Fx, sys), 3) : '—'}</td>
            <td>{r.Mz !== undefined ? fmt(fromSI_moment(r.Mz, sys), 3) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

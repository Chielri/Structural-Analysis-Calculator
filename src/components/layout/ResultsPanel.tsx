import { useBeamStore, type ResultTab } from '../../store/beamStore';
import { DiagramChart } from '../results/DiagramChart';
import { ReactionTable } from '../results/ReactionTable';
import { StressResults } from '../results/StressResults';
import { SummaryCard } from '../results/SummaryCard';
import {
  fromSI_deflection_mm,
  fromSI_force,
  fromSI_length,
  fromSI_moment,
  labels,
} from '../../utils/units';

const TABS: { value: ResultTab; label: string }[] = [
  { value: 'reactions', label: 'Reactions' },
  { value: 'sfd', label: 'SFD' },
  { value: 'bmd', label: 'BMD' },
  { value: 'deflection', label: 'Deflection' },
  { value: 'stress', label: 'Stress' },
];

export function ResultsPanel() {
  const tab = useBeamStore((s) => s.resultTab);
  const setTab = useBeamStore((s) => s.setResultTab);
  const results = useBeamStore((s) => s.results);
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);

  return (
    <div className="panel p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 border-b border-slate-700 -mb-px">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`tab-button ${tab === t.value ? 'tab-button-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3"><SummaryCard /></div>

      <div className="flex-1 overflow-auto">
        {!results && (
          <div className="text-sm text-slate-400 italic p-4">No results — fix errors and re-solve.</div>
        )}

        {results && tab === 'reactions' && <ReactionTable />}

        {results && tab === 'sfd' && (
          <DiagramChart
            data={results.sfd}
            color="#ef4444"
            yLabel="V"
            xUnit={lbl.length}
            yUnit={lbl.force}
            xConv={(v) => fromSI_length(v, sys)}
            yConv={(v) => fromSI_force(v, sys)}
            height={320}
          />
        )}

        {results && tab === 'bmd' && (
          <DiagramChart
            data={results.bmd}
            color="#0ea5e9"
            yLabel="M"
            xUnit={lbl.length}
            yUnit={lbl.moment}
            xConv={(v) => fromSI_length(v, sys)}
            yConv={(v) => fromSI_moment(v, sys)}
            height={320}
          />
        )}

        {results && tab === 'deflection' && (
          <DiagramChart
            data={results.deflection}
            color="#22c55e"
            yLabel="δ"
            xUnit={lbl.length}
            yUnit={lbl.deflection}
            xConv={(v) => fromSI_length(v, sys)}
            yConv={(v) => fromSI_deflection_mm(v, sys)}
            height={320}
          />
        )}

        {results && tab === 'stress' && <StressResults />}
      </div>
    </div>
  );
}

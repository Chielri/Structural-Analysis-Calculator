import { useRef } from 'react';
import { useBeamStore } from '../../store/beamStore';
import { downloadFile, exportPDF, resultsToCSV } from '../../utils/export';

export function Toolbar() {
  const sys = useBeamStore((s) => s.unitSystem);
  const setSys = useBeamStore((s) => s.setUnitSystem);
  const theme = useBeamStore((s) => s.theme);
  const setTheme = useBeamStore((s) => s.setTheme);
  const undo = useBeamStore((s) => s.undo);
  const redo = useBeamStore((s) => s.redo);
  const runSolve = useBeamStore((s) => s.runSolve);
  const errors = useBeamStore((s) => s.errors);
  const results = useBeamStore((s) => s.results);
  const model = useBeamStore((s) => s.model);
  const saveJSON = useBeamStore((s) => s.saveJSON);
  const loadJSON = useBeamStore((s) => s.loadJSON);
  const historyEmpty = useBeamStore((s) => s.history.length === 0);
  const futureEmpty = useBeamStore((s) => s.future.length === 0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleSave() {
    downloadFile('beam-model.json', saveJSON(), 'application/json');
  }

  function handleLoad() {
    fileInputRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = await f.text();
    loadJSON(txt);
    e.target.value = '';
  }

  function handleCSV() {
    if (results) downloadFile('beam-results.csv', resultsToCSV(results), 'text/csv');
  }

  function handlePDF() {
    if (results) exportPDF(model, results);
  }

  return (
    <header className="flex items-center gap-2 px-4 py-2 panel mx-0 mb-3 border-x-0 rounded-none">
      <div className="text-lg font-semibold text-accent mr-4 select-none flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 18h18M5 18l3-12 4 8 4-4 3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Beam Calculator
      </div>

      <div className="flex items-center gap-1">
        <button className="btn btn-ghost" onClick={undo} disabled={historyEmpty} title="Undo (Ctrl+Z)">
          ↶
        </button>
        <button className="btn btn-ghost" onClick={redo} disabled={futureEmpty} title="Redo (Ctrl+Y)">
          ↷
        </button>
      </div>

      <div className="flex items-center gap-2 ml-4">
        <span className="text-xs text-slate-400">Units:</span>
        <select
          className="field-input py-1 text-xs"
          value={sys}
          onChange={(e) => setSys(e.target.value as 'SI' | 'Imperial')}
        >
          <option value="SI">SI (m, kN)</option>
          <option value="Imperial">Imperial (ft, kip)</option>
        </select>
      </div>

      <div className="flex items-center gap-1 ml-2">
        <button
          className="btn btn-ghost"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title="Toggle theme"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
      </div>

      <div className="flex-1" />

      {errors.length > 0 && (
        <div className="text-xs text-bad bg-red-900/30 border border-bad/40 px-2 py-1 rounded">
          {errors[0]}
        </div>
      )}

      <div className="flex items-center gap-1">
        <button className="btn btn-ghost" onClick={handleLoad} title="Load JSON">Load</button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={onFileChosen}
        />
        <button className="btn btn-ghost" onClick={handleSave} title="Save JSON (Ctrl+S)">Save</button>
        <button className="btn btn-ghost" onClick={handleCSV} title="Export CSV">CSV</button>
        <button className="btn btn-ghost" onClick={handlePDF} title="Export PDF">PDF</button>
      </div>

      <button
        className="btn btn-primary px-4 py-1.5 ml-2"
        onClick={runSolve}
        title="Solve (Ctrl+Enter)"
      >
        ▶ Solve
      </button>
    </header>
  );
}

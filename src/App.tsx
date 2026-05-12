import { useEffect } from 'react';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { BeamCanvas } from './components/canvas/BeamCanvas';
import { ResultsPanel } from './components/layout/ResultsPanel';
import { useBeamStore } from './store/beamStore';
import { downloadFile } from './utils/export';

export default function App() {
  const undo = useBeamStore((s) => s.undo);
  const redo = useBeamStore((s) => s.redo);
  const runSolve = useBeamStore((s) => s.runSolve);
  const saveJSON = useBeamStore((s) => s.saveJSON);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (e.key === 's') {
        e.preventDefault();
        downloadFile('beam-model.json', saveJSON(), 'application/json');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        runSolve();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, runSolve, saveJSON]);

  return (
    <div className="h-screen flex flex-col">
      <Toolbar />
      <main className="flex-1 flex gap-3 px-3 pb-3 overflow-hidden">
        <Sidebar />
        <section className="flex-1 flex flex-col gap-3 overflow-hidden min-w-0">
          <div className="h-[42%] flex-shrink-0 min-w-0">
            <BeamCanvas />
          </div>
          <div className="flex-1 overflow-hidden min-w-0">
            <ResultsPanel />
          </div>
        </section>
      </main>
    </div>
  );
}

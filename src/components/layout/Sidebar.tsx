import { useState } from 'react';
import { BeamInput } from '../inputs/BeamInput';
import { SupportInput } from '../inputs/SupportInput';
import {
  DistLoadInput,
  HingeInput,
  MomentInput,
  PointLoadInput,
} from '../inputs/LoadInputs';
import { SectionInput } from '../inputs/SectionInput';
import { useBeamStore, type PresetName, PRESETS } from '../../store/beamStore';

type SidebarTab = 'beam' | 'supports' | 'loads' | 'section' | 'presets';

const TABS: { value: SidebarTab; label: string }[] = [
  { value: 'beam', label: 'Beam' },
  { value: 'supports', label: 'Supports' },
  { value: 'loads', label: 'Loads' },
  { value: 'section', label: 'Section' },
  { value: 'presets', label: 'Presets' },
];

export function Sidebar() {
  const [tab, setTab] = useState<SidebarTab>('beam');
  const loadPreset = useBeamStore((s) => s.loadPreset);

  return (
    <aside className="w-80 flex-shrink-0 panel p-3 flex flex-col overflow-hidden h-full">
      <div className="flex border-b border-slate-700 mb-3 overflow-x-auto -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`tab-button whitespace-nowrap ${tab === t.value ? 'tab-button-active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {tab === 'beam' && <BeamInput />}
        {tab === 'supports' && <SupportInput />}
        {tab === 'loads' && (
          <>
            <PointLoadInput />
            <DistLoadInput />
            <MomentInput />
            <HingeInput />
          </>
        )}
        {tab === 'section' && <SectionInput />}
        {tab === 'presets' && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Example Presets</h3>
            {(Object.keys(PRESETS) as PresetName[]).map((p) => (
              <button
                key={p}
                onClick={() => loadPreset(p)}
                className="btn btn-ghost w-full text-left text-sm"
              >
                {PRESETS[p].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

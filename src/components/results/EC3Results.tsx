import { useBeamStore } from '../../store/beamStore';
import { fmt } from '../../utils/formatting';

/**
 * EC3 steel design results panel.
 */
export function EC3Results() {
  const r = useBeamStore((s) => s.results);
  const section = useBeamStore((s) => s.model.section);
  const material = useBeamStore((s) => s.model.material);
  if (!r) return null;
  if (material.isConcrete) {
    return (
      <div className="text-sm text-slate-400 italic p-4">
        Select a steel material to enable the EC3 design checks.
      </div>
    );
  }
  if (!section.iSection) {
    return (
      <div className="text-sm text-amber-400 italic p-4">
        EC3 needs a UB section with full I/H geometry. Pick one from the
        library to enable.
      </div>
    );
  }
  const d = r.ec3Design;
  if (!d) {
    return (
      <div className="text-sm text-amber-400 italic p-4">
        EC3 results unavailable. Make sure the material has fy &gt; 0 and a UB
        section is selected.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2 font-mono text-sm">
      <Section title="Material & section (§3.2 / Table 5.2)">
        <Grid>
          <Stat label="fy" value={fmt(d.fy, 0)} unit="MPa" />
          <Stat label="ε" value={fmt(d.epsilon, 3)} unit="—" />
          <Stat label="E" value={fmt(d.E, 0)} unit="MPa" />
          <Stat label="G" value={fmt(d.G, 0)} unit="MPa" />
          <Stat label="flange c/tf" value={fmt(d.flange_c_over_t, 2)} unit="—" />
          <Stat label="web c/tw" value={fmt(d.web_c_over_t, 2)} unit="—" />
          <Stat label="class (flange / web)"
            value={`${d.flangeClass} / ${d.webClass}`} unit="—" />
          <Stat label="section class" value={String(d.sectionClass)} unit=""
            warn={d.sectionClass === 4} />
        </Grid>
      </Section>

      <Section title="Cross-section resistance (§6.2)">
        <Grid>
          <Stat label="M_Ed" value={fmt(d.M_Ed / 1e6, 1)} unit="kN·m" />
          <Stat label="Mc,Rd" value={fmt(d.Mc_Rd / 1e6, 1)} unit="kN·m" />
          <Stat label="V_Ed" value={fmt(d.V_Ed / 1e3, 1)} unit="kN" />
          <Stat label="Vpl,Rd" value={fmt(d.Vpl_Rd / 1e3, 1)} unit="kN" />
          <Stat label="Av" value={fmt(d.Av, 0)} unit="mm²" />
          <Stat label="ρ (shear int.)" value={fmt(d.rho_shear, 3)} unit="—" />
          <Stat label="My,V,Rd" value={fmt(d.My_V_Rd / 1e6, 1)} unit="kN·m" />
          <Stat label="hw/tw shear buck."
            value={d.shearBucklingFlag ? 'EN 1993-1-5' : 'OK'} unit=""
            warn={d.shearBucklingFlag} />
        </Grid>
      </Section>

      <Section title="Lateral-torsional buckling (§6.3.2)">
        <Grid>
          <Stat label="Active" value={d.ltbActive ? 'Yes' : 'No'} unit="" />
          <Stat label="Mcr" value={Number.isFinite(d.Mcr) ? fmt(d.Mcr / 1e6, 1) : '∞'} unit="kN·m" />
          <Stat label="λ̄LT" value={fmt(d.lambda_LT, 3)} unit="—" />
          <Stat label="curve" value={d.ltbCurve} unit="" />
          <Stat label="χLT" value={fmt(d.chi_LT, 3)} unit="—" />
          <Stat label="χLT,mod" value={fmt(d.chi_LT_mod, 3)} unit="—" />
          <Stat label="f" value={fmt(d.f_correction, 3)} unit="—" />
          <Stat label="Mb,Rd" value={fmt(d.Mb_Rd / 1e6, 1)} unit="kN·m" />
        </Grid>
      </Section>

      <Section title="Code checks">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <CheckRow label="M_Ed / min(Mc,Rd, Mb,Rd)" actual={d.utilM} limit={1.0}
            pass={d.pass_M} unit="" />
          <CheckRow label="V_Ed / Vpl,Rd" actual={d.utilV} limit={1.0}
            pass={d.pass_V} unit="" />
        </div>
      </Section>

      {d.warnings.length > 0 && (
        <div className="text-xs text-amber-300 border border-amber-700/40 bg-amber-900/20 px-3 py-2 rounded space-y-1">
          {d.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}

      <div className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-700">
        SS EN 1993-1-1:2010. Mcr from NCCI SN003 simplified (kz=kw=1, zg=0).
        Class 4 sections use Wel,y (full effective-width design per EN
        1993-1-5 is not implemented).
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">{title}</div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;
}

function Stat({ label, value, unit, warn }:
  { label: string; value: string; unit: string; warn?: boolean }) {
  return (
    <div className="panel p-2">
      <div className="text-[11px] text-slate-400 mb-0.5">{label}</div>
      <div className={`text-sm ${warn ? 'text-bad' : 'text-accent'}`}>
        {value} <span className="text-[11px] text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

function CheckRow({ label, actual, limit, pass, unit }:
  { label: string; actual: number; limit: number; pass: boolean; unit: string }) {
  return (
    <div className={`panel p-2 flex items-center justify-between ${pass ? '' : 'border-bad'}`}>
      <div>
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className="text-xs">{fmt(actual, 3)} {unit} vs {fmt(limit, 2)} {unit}</div>
      </div>
      <div className={`text-sm font-semibold ${pass ? 'text-accent' : 'text-bad'}`}>
        {pass ? 'PASS' : 'FAIL'}
      </div>
    </div>
  );
}

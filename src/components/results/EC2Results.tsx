import { useBeamStore } from '../../store/beamStore';
import { fmt } from '../../utils/formatting';

/**
 * Display panel for EC2 Cl. 7.4.3 RC deflection results.
 * Only renders when results.ec2 is present (i.e. concrete material selected
 * with valid concrete inputs).
 */
export function EC2Results() {
  const r = useBeamStore((s) => s.results);
  const concrete = useBeamStore((s) => s.model.concrete);
  const material = useBeamStore((s) => s.model.material);
  if (!r) return null;
  if (!material.isConcrete) {
    return (
      <div className="text-sm text-slate-400 italic p-4">
        Select a concrete material to enable the EC2 7.4.3 long-term
        deflection check.
      </div>
    );
  }
  if (!concrete) {
    return (
      <div className="text-sm text-slate-400 italic p-4">
        EC2 inputs not initialised — re-select the material.
      </div>
    );
  }
  const ec2 = r.ec2;
  if (!ec2) {
    return (
      <div className="text-sm text-amber-400 italic p-4">
        EC2 check unavailable. Make sure the section is a Rectangle (b × h)
        and that loads produce a positive sagging moment.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2 font-mono text-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="fcm" value={fmt(ec2.fcm, 2)} unit="MPa" />
        <Stat label="fctm" value={fmt(ec2.fctm, 2)} unit="MPa" />
        <Stat label="Ecm" value={fmt(ec2.Ecm, 0)} unit="MPa" />
        <Stat label="Ec,eff" value={fmt(ec2.Ec_eff, 0)} unit="MPa" />
        <Stat label="αe" value={fmt(ec2.alpha_e, 2)} unit="—" />
        <Stat
          label="State"
          value={ec2.cracked ? 'Cracked' : 'Uncracked'}
          unit=""
          warn={ec2.cracked}
        />
      </div>

      <Section title="Section properties">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="x_I" value={fmt(ec2.x_I, 1)} unit="mm" />
          <Stat label="I_I" value={ec2.I_I.toExponential(3)} unit="mm⁴" />
          <Stat label="x_II" value={fmt(ec2.x_II, 1)} unit="mm" />
          <Stat label="I_II" value={ec2.I_II.toExponential(3)} unit="mm⁴" />
        </div>
      </Section>

      <Section title="Cracking & interpolation">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Mcr" value={fmt(ec2.Mcr / 1e6, 2)} unit="kN·m" />
          <Stat label="M_qp" value={fmt(ec2.M_qp / 1e6, 2)} unit="kN·m" />
          <Stat label="ζ" value={fmt(ec2.zeta, 3)} unit="—" />
          <Stat
            label="κm (flex)"
            value={ec2.kappa_m.toExponential(3)}
            unit="1/mm"
          />
        </div>
      </Section>

      <Section title="Deflection contributions">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="δ flex" value={fmt(ec2.delta_flex, 2)} unit="mm" />
          <Stat label="δ shrink" value={fmt(ec2.delta_shrink, 2)} unit="mm" />
          <Stat
            label="δ total"
            value={fmt(ec2.delta_total, 2)}
            unit="mm"
            warn={!ec2.pass_L250}
          />
          <Stat label="δ inst" value={fmt(ec2.delta_inst, 2)} unit="mm" />
          <Stat
            label="δ post"
            value={fmt(ec2.delta_post, 2)}
            unit="mm"
            warn={!ec2.pass_L500}
          />
          <Stat
            label="k_flex / k_shrink"
            value={`${fmt(ec2.k_flex, 3)} / ${fmt(ec2.k_shrink, 3)}`}
            unit="—"
          />
        </div>
      </Section>

      <Section title="Code checks">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <CheckRow
            label="L/250 — total deflection (Cl. 7.4.1(4))"
            actual={ec2.delta_total}
            limit={ec2.limit_L250}
            pass={ec2.pass_L250}
          />
          <CheckRow
            label="L/500 — post-construction (Cl. 7.4.1(5))"
            actual={ec2.delta_post}
            limit={ec2.limit_L500}
            pass={ec2.pass_L500}
          />
        </div>
      </Section>

      {ec2.warnings.length > 0 && (
        <div className="text-xs text-amber-300 border border-amber-700/40 bg-amber-900/20 px-3 py-2 rounded space-y-1">
          {ec2.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}

      <div className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-700">
        Procedure: SS EN 1992-1-1 Cl. 7.4.3, Eq. (7.18)–(7.21). Curvature is
        interpolated between uncracked and cracked states; mid-span
        deflection uses k_f · κ · L² (5/48 for UDL flexure, 1/8 for
        uniform shrinkage; 1/4 and 1/2 for cantilevers).
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  warn,
}: {
  label: string;
  value: string;
  unit: string;
  warn?: boolean;
}) {
  return (
    <div className="panel p-2">
      <div className="text-[11px] text-slate-400 mb-0.5">{label}</div>
      <div className={`text-sm ${warn ? 'text-bad' : 'text-accent'}`}>
        {value} <span className="text-[11px] text-slate-500">{unit}</span>
      </div>
    </div>
  );
}

function CheckRow({
  label,
  actual,
  limit,
  pass,
}: {
  label: string;
  actual: number;
  limit: number;
  pass: boolean;
}) {
  return (
    <div
      className={`panel p-2 flex items-center justify-between ${pass ? '' : 'border-bad'}`}
    >
      <div>
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className="text-xs">
          {fmt(actual, 2)} mm vs limit {fmt(limit, 2)} mm
        </div>
      </div>
      <div className={`text-sm font-semibold ${pass ? 'text-accent' : 'text-bad'}`}>
        {pass ? 'PASS' : 'FAIL'}
      </div>
    </div>
  );
}

import { useBeamStore } from '../../store/beamStore';
import { fmt } from '../../utils/formatting';

/**
 * EC2 + SG NA results panel.
 * Renders the full design pipeline (bending, shear, l/d, crack, detailing)
 * plus the Cl. 7.4.3 curvature deflection if available.
 */
export function EC2Results() {
  const r = useBeamStore((s) => s.results);
  const concrete = useBeamStore((s) => s.model.concrete);
  const material = useBeamStore((s) => s.model.material);
  const applyDesigned = useBeamStore((s) => s.applyDesignedRebar);
  if (!r) return null;
  if (!material.isConcrete) {
    return (
      <div className="text-sm text-slate-400 italic p-4">
        Select a concrete material to enable the EC2 + SG NA beam design.
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

  const d = r.ec2Design;
  const ec2 = r.ec2;

  if (!d && !ec2) {
    return (
      <div className="text-sm text-amber-400 italic p-4">
        EC2 outputs unavailable. Use a Rectangle section (b × h).
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2 font-mono text-sm">
      {d && (
        <>
          <Section title="Materials & section">
            <Grid>
              <Stat label="fcd" value={fmt(d.fcd, 2)} unit="MPa" />
              <Stat label="fyd" value={fmt(d.fyd, 2)} unit="MPa" />
              <Stat label="fctm" value={fmt(d.fctm, 2)} unit="MPa" />
              <Stat label="fctd" value={fmt(d.fctd, 2)} unit="MPa" />
              <Stat label="Ecm" value={fmt(d.Ecm, 0)} unit="MPa" />
              <Stat label="b × h" value={`${fmt(d.b, 0)}×${fmt(d.h, 0)}`} unit="mm" />
              <Stat label="d" value={fmt(d.d, 1)} unit="mm" />
              <Stat label="d′" value={fmt(d.d_prime, 1)} unit="mm" />
            </Grid>
          </Section>

          <Section title="Bending (Cl. 6.1)">
            <Grid>
              <Stat label="M_Ed" value={fmt(d.M_Ed / 1e6, 2)} unit="kN·m" />
              <Stat label="K / K_lim"
                value={`${fmt(d.K, 3)} / ${fmt(d.K_lim, 3)}`} unit="—"
                warn={d.K > d.K_lim} />
              <Stat label="x/d_lim" value={fmt(d.x_over_d_lim, 3)} unit="—" />
              <Stat label="z" value={fmt(d.z, 1)} unit="mm" />
              <Stat label="As_req" value={fmt(d.As_req, 0)} unit="mm²"
                warn={!d.bendingFeasible} />
              <Stat label="A's_req" value={fmt(d.As2_req, 0)} unit="mm²"
                warn={d.doublyReinforced && !d.compSteelYielding} />
              <Stat label="As_min" value={fmt(d.As_min, 0)} unit="mm²" />
              <Stat label="As_max" value={fmt(d.As_max, 0)} unit="mm²" />
              <Stat label="As prov." value={fmt(concrete.As, 0)} unit="mm²"
                warn={concrete.As < d.As_req} />
              <Stat label="As_req / As_prov"
                value={Number.isFinite(d.utilization)
                  ? (d.utilization * 100).toFixed(1) + '%' : '∞'}
                unit="" warn={d.utilization > 1} />
            </Grid>
            <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
              <div className="text-[11px] text-slate-400">
                {d.doublyReinforced
                  ? "K > K_lim → doubly reinforced."
                  : 'K ≤ K_lim → singly reinforced.'}
                {d.doublyReinforced && !d.compSteelYielding
                  ? ' ⚠ Compression steel below yield — depth-limited.'
                  : ''}
              </div>
              <button
                className="btn btn-primary text-xs"
                onClick={applyDesigned}
                disabled={!d.bendingFeasible}
                title="Copy As/A's required into the EC2 deflection inputs"
              >
                Apply to deflection
              </button>
            </div>
          </Section>

          <Section title="Shear — variable strut (Cl. 6.2.3)">
            <Grid>
              <Stat label="V_Ed" value={fmt(d.V_Ed / 1e3, 1)} unit="kN" />
              <Stat label="cot θ"
                value={Number.isFinite(d.cot_theta) ? fmt(d.cot_theta, 2) : '—'}
                unit="—"
                warn={!d.shearFeasible} />
              <Stat label="θ" value={Number.isFinite(d.theta_deg) ? fmt(d.theta_deg, 1) : '—'} unit="°" />
              <Stat label="VRd,max" value={fmt(d.VRd_max / 1e3, 1)} unit="kN" />
              <Stat label="Asw/s req" value={fmt(d.Asw_per_s_req * 1000, 1)} unit="mm²/m" />
              <Stat label="Asw/s min" value={fmt(d.Asw_per_s_min * 1000, 1)} unit="mm²/m" />
              <Stat label="s_l,max" value={fmt(d.sl_max, 0)} unit="mm" />
              <Stat label="s_t,max" value={fmt(d.st_max, 0)} unit="mm" />
              <Stat label="ΔF_td" value={fmt(d.dFtd_kN, 1)} unit="kN" />
            </Grid>
          </Section>

          <Section title="Deflection — l/d (Cl. 7.4.2 + Tbl NA.5)">
            <Grid>
              <Stat label="ρ" value={(d.rho * 1000).toFixed(2) + '‰'} unit="" />
              <Stat label="ρ₀" value={(d.rho0 * 1000).toFixed(2) + '‰'} unit="" />
              <Stat label="ρ′" value={(d.rho2 * 1000).toFixed(2) + '‰'} unit="" />
              <Stat label="l/d actual" value={fmt(d.ld_actual, 1)} unit="—"
                warn={!d.pass_ld} />
              <Stat label="l/d allow" value={fmt(d.ld_allow, 1)} unit="—" />
              <Stat label="l/d basic" value={fmt(d.ld_basic, 1)} unit="—" />
            </Grid>
            <CheckRow label="l/d ≤ allowable" actual={d.ld_actual}
              limit={d.ld_allow} pass={d.pass_ld} unit="—" />
          </Section>

          <Section title="Crack control (Cl. 7.3.4)">
            <Grid>
              <Stat label="M_qp" value={fmt(d.M_qp / 1e6, 2)} unit="kN·m" />
              <Stat label="σs (QP)" value={fmt(d.sigma_s_qp, 1)} unit="MPa" />
              <Stat label="hc,ef" value={fmt(d.hc_ef, 1)} unit="mm" />
              <Stat label="ρp,eff" value={(d.rho_p_eff * 100).toFixed(2) + '%'} unit="" />
              <Stat label="sr,max" value={fmt(d.sr_max, 1)} unit="mm" />
              <Stat label="αe" value={fmt(d.alpha_e, 2)} unit="—" />
              <Stat label="wk" value={fmt(d.wk, 3)} unit="mm" warn={!d.pass_crack} />
              <Stat label="As_min,crack" value={fmt(d.As_min_crack, 0)} unit="mm²" />
            </Grid>
            <CheckRow label="wk ≤ w_max" actual={d.wk} limit={d.wmax}
              pass={d.pass_crack} unit="mm" />
          </Section>

          <Section title="SLS stress limits (Cl. 7.2)">
            <Grid>
              <Stat label="σc,char limit" value={fmt(d.sigma_c_lim_char, 1)} unit="MPa" />
              <Stat label="σs,char limit" value={fmt(d.sigma_s_lim_char, 1)} unit="MPa" />
              <Stat label="σs,qp limit" value={fmt(d.sigma_s_lim_qp, 1)} unit="MPa" />
            </Grid>
          </Section>

          <Section title="Detailing (Cl. 8, 9.2)">
            <Grid>
              <Stat label="fbd" value={fmt(d.fbd, 2)} unit="MPa" />
              <Stat label="lb,rqd" value={fmt(d.lb_rqd, 0)} unit="mm" />
              <Stat label="lbd" value={fmt(d.lbd, 0)} unit="mm" />
              <Stat label="l0 (lap)" value={fmt(d.l0, 0)} unit="mm" />
              <Stat label="φ_mandrel min" value={fmt(d.phi_mandrel_min, 0)} unit="mm" />
              <Stat label="s_clear min" value={fmt(d.s_clear_min, 0)} unit="mm" />
            </Grid>
          </Section>
        </>
      )}

      {ec2 && (
        <Section title="Long-term deflection — calc method (Cl. 7.4.3)">
          <Grid>
            <Stat label="State" value={ec2.cracked ? 'Cracked' : 'Uncracked'}
              unit="" warn={ec2.cracked} />
            <Stat label="Mcr" value={fmt(ec2.Mcr / 1e6, 2)} unit="kN·m" />
            <Stat label="ζ" value={fmt(ec2.zeta, 3)} unit="—" />
            <Stat label="δ total" value={fmt(ec2.delta_total, 2)} unit="mm"
              warn={!ec2.pass_L250} />
            <Stat label="δ post" value={fmt(ec2.delta_post, 2)} unit="mm"
              warn={!ec2.pass_L500} />
            <Stat label="δ flex" value={fmt(ec2.delta_flex, 2)} unit="mm" />
            <Stat label="δ shrink" value={fmt(ec2.delta_shrink, 2)} unit="mm" />
          </Grid>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            <CheckRow label="L/250 — total"
              actual={ec2.delta_total} limit={ec2.limit_L250}
              pass={ec2.pass_L250} unit="mm" />
            <CheckRow label="L/500 — post-construction"
              actual={ec2.delta_post} limit={ec2.limit_L500}
              pass={ec2.pass_L500} unit="mm" />
          </div>
        </Section>
      )}

      {d && d.warnings.length > 0 && (
        <div className="text-xs text-amber-300 border border-amber-700/40 bg-amber-900/20 px-3 py-2 rounded space-y-1">
          {d.warnings.map((w, i) => (<div key={i}>⚠ {w}</div>))}
        </div>
      )}

      <div className="text-[11px] text-slate-400 leading-relaxed pt-2 border-t border-slate-700">
        SS EN 1992-1-1:2008 + SG NA. Bending uses the rectangular stress block
        (λ = 0.8, η = 1.0, fck ≤ 50 MPa). Shear uses variable-strut with cot θ
        ∈ [1.0, 2.5]. Deflection l/d follows Tbl NA.5 (stress mod ≤ 1.5,
        absolute cap 40·K_sys).
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

function CheckRow({ label, actual, limit, pass, unit }: {
  label: string; actual: number; limit: number; pass: boolean; unit: string;
}) {
  return (
    <div className={`panel p-2 flex items-center justify-between mt-2 ${pass ? '' : 'border-bad'}`}>
      <div>
        <div className="text-[11px] text-slate-400">{label}</div>
        <div className="text-xs">
          {fmt(actual, 2)} {unit} vs {fmt(limit, 2)} {unit}
        </div>
      </div>
      <div className={`text-sm font-semibold ${pass ? 'text-accent' : 'text-bad'}`}>
        {pass ? 'PASS' : 'FAIL'}
      </div>
    </div>
  );
}

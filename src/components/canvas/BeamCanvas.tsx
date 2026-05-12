import { useEffect, useRef, useState } from 'react';
import { useBeamStore } from '../../store/beamStore';
import type { Support, Hinge, PointLoad, DistributedLoad, AppliedMoment } from '../../solver/types';
import { fromSI_length, fromSI_force, fromSI_distLoad, fromSI_moment, labels } from '../../utils/units';
import { fmt } from '../../utils/formatting';

const PAD = { left: 60, right: 60, top: 80, bottom: 80 };

export function BeamCanvas() {
  const model = useBeamStore((s) => s.model);
  const sys = useBeamStore((s) => s.unitSystem);
  const lbl = labels(sys);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 360 });
  const [hoverX, setHoverX] = useState<number | null>(null);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const parent = svgRef.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver((entries) => {
      for (const ent of entries) {
        setSize({ w: Math.max(400, ent.contentRect.width), h: 360 });
      }
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const beamY = size.h / 2;
  const scale = (size.w - PAD.left - PAD.right) / Math.max(model.length, 0.001);

  const toX = (xModel: number) => PAD.left + xModel * scale;

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const xModel = (sx - PAD.left) / scale;
    setHoverX(xModel);
  }

  return (
    <div className="panel p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-slate-400">Beam Schematic</div>
        {hoverX !== null && (
          <div className="text-xs font-mono text-accent">x = {fromSI_length(hoverX, sys).toFixed(3)} {lbl.length}</div>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <svg
          ref={svgRef}
          width={size.w}
          height={size.h}
          className="block w-full"
          onMouseMove={(e) => {
            const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect();
            if (!rect) return;
            const sx = e.clientX - rect.left;
            const xModel = (sx - PAD.left) / scale;
            if (xModel >= 0 && xModel <= model.length) setHoverX(xModel);
            else setHoverX(null);
          }}
          onMouseLeave={() => setHoverX(null)}
          onClick={handleClick}
        >
          {/* Grid */}
          {Array.from({ length: 11 }).map((_, i) => {
            const x = PAD.left + ((size.w - PAD.left - PAD.right) * i) / 10;
            return (
              <line
                key={i}
                x1={x}
                x2={x}
                y1={PAD.top - 20}
                y2={size.h - PAD.bottom + 20}
                stroke="rgba(255,255,255,0.04)"
                strokeDasharray="2 4"
              />
            );
          })}

          {/* Distributed loads */}
          {model.loads.filter((l): l is DistributedLoad => l.kind === 'distributed').map((l) => (
            <DistLoadGlyph key={l.id} l={l} toX={toX} beamY={beamY} sys={sys} unitLabel={lbl.distLoad} />
          ))}

          {/* Beam */}
          <line
            x1={toX(0)}
            x2={toX(model.length)}
            y1={beamY}
            y2={beamY}
            stroke="#94a3b8"
            strokeWidth={4}
          />

          {/* Supports */}
          {model.supports.map((s) => (
            <SupportGlyph key={s.id} s={s} toX={toX} beamY={beamY} />
          ))}

          {/* Hinges */}
          {model.hinges.map((h) => (
            <HingeGlyph key={h.id} h={h} toX={toX} beamY={beamY} />
          ))}

          {/* Point loads */}
          {model.loads.filter((l): l is PointLoad => l.kind === 'point').map((l) => (
            <PointLoadGlyph key={l.id} l={l} toX={toX} beamY={beamY} sys={sys} unitLabel={lbl.force} />
          ))}

          {/* Applied moments */}
          {model.loads.filter((l): l is AppliedMoment => l.kind === 'moment').map((l) => (
            <MomentGlyph key={l.id} l={l} toX={toX} beamY={beamY} sys={sys} unitLabel={lbl.moment} />
          ))}

          {/* Dimension line */}
          <DimensionLine model={model} toX={toX} y={size.h - PAD.bottom + 40} sys={sys} unitLabel={lbl.length} />

          {/* Hover marker */}
          {hoverX !== null && (
            <line
              x1={toX(hoverX)}
              x2={toX(hoverX)}
              y1={PAD.top - 20}
              y2={size.h - PAD.bottom + 30}
              stroke="#0ea5e9"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

function SupportGlyph({ s, toX, beamY }: { s: Support; toX: (x: number) => number; beamY: number }) {
  const x = toX(s.position);
  if (s.type === 'pin') {
    return (
      <g>
        <polygon points={`${x},${beamY} ${x - 12},${beamY + 24} ${x + 12},${beamY + 24}`} fill="#0ea5e9" />
        <line x1={x - 16} x2={x + 16} y1={beamY + 24} y2={beamY + 24} stroke="#94a3b8" strokeWidth={2} />
        {/* hatching */}
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={i} x1={x - 12 + i * 6} x2={x - 16 + i * 6} y1={beamY + 24} y2={beamY + 32} stroke="#64748b" />
        ))}
      </g>
    );
  }
  if (s.type === 'roller') {
    return (
      <g>
        <circle cx={x} cy={beamY + 8} r={8} fill="#0ea5e9" />
        <line x1={x - 16} x2={x + 16} y1={beamY + 18} y2={beamY + 18} stroke="#94a3b8" strokeWidth={2} />
        {Array.from({ length: 5 }).map((_, i) => (
          <line key={i} x1={x - 12 + i * 6} x2={x - 16 + i * 6} y1={beamY + 18} y2={beamY + 26} stroke="#64748b" />
        ))}
      </g>
    );
  }
  if (s.type === 'fixed') {
    return (
      <g>
        <rect x={x - 4} y={beamY - 20} width={4} height={40} fill="#0ea5e9" />
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={i} x1={x - 4} x2={x - 12} y1={beamY - 18 + i * 7} y2={beamY - 12 + i * 7} stroke="#64748b" />
        ))}
      </g>
    );
  }
  if (s.type === 'spring') {
    const zig: string[] = [];
    for (let i = 0; i < 6; i++) {
      const off = i % 2 === 0 ? -5 : 5;
      zig.push(`${x + off},${beamY + 6 + i * 4}`);
    }
    return (
      <g>
        <polyline points={zig.join(' ')} fill="none" stroke="#0ea5e9" strokeWidth={2} />
        <line x1={x - 14} x2={x + 14} y1={beamY + 32} y2={beamY + 32} stroke="#94a3b8" />
      </g>
    );
  }
  return null;
}

function HingeGlyph({ h, toX, beamY }: { h: Hinge; toX: (x: number) => number; beamY: number }) {
  const x = toX(h.position);
  return <circle cx={x} cy={beamY} r={6} fill="#0f172a" stroke="#f59e0b" strokeWidth={2} />;
}

function PointLoadGlyph({
  l,
  toX,
  beamY,
  sys,
  unitLabel,
}: {
  l: PointLoad;
  toX: (x: number) => number;
  beamY: number;
  sys: import('../../utils/units').UnitSystem;
  unitLabel: string;
}) {
  const x = toX(l.position);
  const len = 50;
  const tipY = beamY - 3;
  const tailY = tipY - len;
  return (
    <g>
      <line x1={x} x2={x} y1={tailY} y2={tipY} stroke="#ef4444" strokeWidth={2} />
      <polygon points={`${x},${tipY} ${x - 5},${tipY - 8} ${x + 5},${tipY - 8}`} fill="#ef4444" />
      <text x={x} y={tailY - 4} textAnchor="middle" fontSize={11} fill="#fca5a5" fontFamily="JetBrains Mono">
        {fmt(fromSI_force(l.magnitude, sys), 2)} {unitLabel}
      </text>
    </g>
  );
}

function DistLoadGlyph({
  l,
  toX,
  beamY,
  sys,
  unitLabel,
}: {
  l: DistributedLoad;
  toX: (x: number) => number;
  beamY: number;
  sys: import('../../utils/units').UnitSystem;
  unitLabel: string;
}) {
  const xs = toX(l.startPos);
  const xe = toX(l.endPos);
  const baseY = beamY - 4;
  const maxArrow = 40;
  const maxMag = Math.max(Math.abs(l.startMag), Math.abs(l.endMag), 1e-9);
  const yAt = (mag: number) => baseY - (Math.abs(mag) / maxMag) * maxArrow;

  // Render arrows
  const n = Math.max(5, Math.round((xe - xs) / 25));
  const arrows = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = xs + (xe - xs) * t;
    const mag = l.startMag + t * (l.endMag - l.startMag);
    const y = yAt(mag);
    arrows.push(
      <g key={i}>
        <line x1={x} x2={x} y1={y} y2={baseY} stroke="#f97316" strokeWidth={1.5} />
        <polygon points={`${x},${baseY} ${x - 3},${baseY - 6} ${x + 3},${baseY - 6}`} fill="#f97316" />
      </g>,
    );
  }
  return (
    <g>
      <polygon
        points={`${xs},${yAt(l.startMag)} ${xe},${yAt(l.endMag)} ${xe},${baseY} ${xs},${baseY}`}
        fill="rgba(249,115,22,0.18)"
        stroke="#f97316"
        strokeWidth={1}
      />
      {arrows}
      <text x={xs} y={yAt(l.startMag) - 4} fontSize={10} fill="#fdba74" fontFamily="JetBrains Mono">
        {fmt(fromSI_distLoad(l.startMag, sys), 2)} {unitLabel}
      </text>
      <text x={xe} y={yAt(l.endMag) - 4} fontSize={10} fill="#fdba74" textAnchor="end" fontFamily="JetBrains Mono">
        {fmt(fromSI_distLoad(l.endMag, sys), 2)}
      </text>
    </g>
  );
}

function MomentGlyph({
  l,
  toX,
  beamY,
  sys,
  unitLabel,
}: {
  l: AppliedMoment;
  toX: (x: number) => number;
  beamY: number;
  sys: import('../../utils/units').UnitSystem;
  unitLabel: string;
}) {
  const x = toX(l.position);
  const cw = l.magnitude > 0;
  const r = 18;
  // arc from top going clockwise (CW) to right
  const startAngle = cw ? Math.PI : 0;
  const endAngle = cw ? 1.7 * Math.PI : 1.3 * Math.PI;
  const start = { x: x + r * Math.cos(startAngle), y: beamY + r * Math.sin(startAngle) };
  const end = { x: x + r * Math.cos(endAngle), y: beamY + r * Math.sin(endAngle) };
  const sweepFlag = cw ? 1 : 0;
  const arc = `M ${start.x} ${start.y} A ${r} ${r} 0 0 ${sweepFlag} ${end.x} ${end.y}`;
  return (
    <g>
      <path d={arc} fill="none" stroke="#a78bfa" strokeWidth={2} />
      <polygon
        points={`${end.x},${end.y} ${end.x - 5},${end.y - 4} ${end.x + 3},${end.y + 4}`}
        fill="#a78bfa"
      />
      <text x={x} y={beamY - r - 6} textAnchor="middle" fontSize={11} fill="#c4b5fd" fontFamily="JetBrains Mono">
        {fmt(fromSI_moment(l.magnitude, sys), 2)} {unitLabel}
      </text>
    </g>
  );
}

function DimensionLine({
  model,
  toX,
  y,
  sys,
  unitLabel,
}: {
  model: import('../../solver/types').BeamModel;
  toX: (x: number) => number;
  y: number;
  sys: import('../../utils/units').UnitSystem;
  unitLabel: string;
}) {
  const positions = Array.from(
    new Set([0, model.length, ...model.supports.map((s) => s.position)]),
  ).sort((a, b) => a - b);
  return (
    <g>
      <line x1={toX(0)} x2={toX(model.length)} y1={y} y2={y} stroke="#64748b" />
      {positions.map((p, i) => (
        <g key={i}>
          <line x1={toX(p)} x2={toX(p)} y1={y - 6} y2={y + 6} stroke="#64748b" />
          <text x={toX(p)} y={y + 22} textAnchor="middle" fontSize={10} fill="#94a3b8" fontFamily="JetBrains Mono">
            {fromSI_length(p, sys).toFixed(2)}
          </text>
        </g>
      ))}
      <text x={toX(model.length) + 8} y={y + 4} fontSize={10} fill="#94a3b8">
        {unitLabel}
      </text>
    </g>
  );
}

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmt } from '../../utils/formatting';

export interface DiagramChartProps {
  data: { x: number; value: number }[];
  color: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  height?: number;
  xConv?: (v: number) => number;
  yConv?: (v: number) => number;
}

export function DiagramChart({
  data,
  color,
  yLabel,
  xUnit,
  yUnit,
  height = 240,
  xConv = (v) => v,
  yConv = (v) => v,
}: DiagramChartProps) {
  const transformed = data.map((p) => ({ x: xConv(p.x), value: yConv(p.value) }));
  return (
    <div style={{ width: '100%', height }} className="font-mono text-xs">
      <ResponsiveContainer>
        <AreaChart data={transformed} margin={{ top: 12, right: 18, bottom: 24, left: 36 }}>
          <defs>
            <linearGradient id={`g-${yLabel}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.7} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis
            type="number"
            dataKey="x"
            tickFormatter={(v) => fmt(v, 2)}
            stroke="#94a3b8"
            domain={['dataMin', 'dataMax']}
            label={{ value: `x (${xUnit})`, position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10 }}
          />
          <YAxis
            tickFormatter={(v) => fmt(v, 2)}
            stroke="#94a3b8"
            label={{ value: `${yLabel} (${yUnit})`, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(15,23,42,0.95)',
              border: '1px solid #334155',
              fontSize: 11,
            }}
            labelFormatter={(v) => `x = ${fmt(Number(v), 3)} ${xUnit}`}
            formatter={(v) => [`${fmt(Number(v), 3)} ${yUnit}`, yLabel]}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#g-${yLabel})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

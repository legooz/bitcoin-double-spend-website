import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatElapsed, formatProbability } from '../format';
import type { ProbabilityPoint } from '../types';

interface Props {
  points: ProbabilityPoint[];
  color?: string;
  height?: number;
  showTooltip?: boolean;
}

export function ProbabilityChart({ points, color = '#e89a3d', height = 300, showTooltip = true }: Props) {
  if (points.length === 0) {
    return <div className="graph-empty">No data yet.</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="elapsed_seconds"
          tickFormatter={(v) => formatElapsed(v as number)}
          stroke="#64748b"
          fontSize={12}
        />
        <YAxis
          tickFormatter={(v) => formatProbability(v as number)}
          stroke="#64748b"
          fontSize={12}
          width={72}
          domain={[0, 'auto']}
        />
        {showTooltip && (
          <Tooltip
            formatter={(v) => [formatProbability(v as number), 'Double-spend']}
            labelFormatter={(l) => `Elapsed: ${formatElapsed(l as number)}`}
            contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="probability"
          stroke={color}
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

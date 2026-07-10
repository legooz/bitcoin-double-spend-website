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
  title: string;
  color?: string;
}

export function ProbabilityChart({ points, title, color = '#f7931a' }: Props) {
  return (
    <div className="chart">
      <h3>{title}</h3>
      {points.length === 0 ? (
        <div className="chart-empty">No data yet.</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey="elapsed_seconds"
              tickFormatter={(v) => formatElapsed(v as number)}
              stroke="#888"
              fontSize={12}
            />
            <YAxis
              tickFormatter={(v) => formatProbability(v as number)}
              stroke="#888"
              fontSize={12}
              width={78}
              domain={[0, 'auto']}
            />
            <Tooltip
              formatter={(v) => [formatProbability(v as number), 'Double-spend']}
              labelFormatter={(l) => `Elapsed: ${formatElapsed(l as number)}`}
              contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
            />
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
      )}
    </div>
  );
}

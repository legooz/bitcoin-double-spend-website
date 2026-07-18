import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';

import { comparisonPoints } from '../comparisonGraph';
import type { ComparisonPoint } from '../comparisonGraph';
import { formatElapsed, formatProbability } from '../format';

// Fixed series identities: blue = confirmations-only (Nakamoto), orange =
// confirmations + time (Neumayer), matching the site's primary chart color.
const NAKAMOTO_COLOR = '#3b82f6';
const NEUMAYER_COLOR = '#e89a3d';
const NAKAMOTO_NAME = 'Confirmations only (Nakamoto 2008)';
const NEUMAYER_NAME = 'Confirmations + time (Neumayer et al. 2018)';

function renderTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload as ComparisonPoint;
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        color: '#0f172a',
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      <div>Elapsed: {formatElapsed(label as number)}</div>
      <div style={{ color: NAKAMOTO_COLOR }}>
        Confirmations only: <strong>{formatProbability(point.nakamoto)}</strong>
      </div>
      <div style={{ color: NEUMAYER_COLOR }}>
        Confirmations + time: <strong>{formatProbability(point.neumayer)}</strong>
      </div>
    </div>
  );
}

export function ComparisonChart({ height = 320 }: { height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={comparisonPoints} margin={{ top: 8, right: 16, bottom: 20, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="elapsed_seconds"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(v) => formatElapsed(v as number)}
          minTickGap={20}
          stroke="#64748b"
          fontSize={12}
          label={{ value: 'Time elapsed', position: 'bottom', offset: 0, fill: '#64748b', fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(v) => formatProbability(v as number)}
          stroke="#64748b"
          fontSize={12}
          width={88}
          domain={[0, 1]}
          label={{
            value: 'Double-spend probability',
            angle: -90,
            position: 'insideLeft',
            offset: 4,
            style: { textAnchor: 'middle' },
            fill: '#64748b',
            fontSize: 12,
          }}
        />
        <Tooltip content={renderTooltip} />
        <Legend verticalAlign="top" height={40} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="nakamoto"
          name={NAKAMOTO_NAME}
          stroke={NAKAMOTO_COLOR}
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="neumayer"
          name={NEUMAYER_NAME}
          stroke={NEUMAYER_COLOR}
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

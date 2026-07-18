import { useEffect, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';

import { formatAxisDate, formatElapsed, formatProbability, formatUtc } from '../format';
import type { ProbabilityPoint } from '../types';

interface Props {
  points: ProbabilityPoint[];
  color?: string;
  height?: number;
  showTooltip?: boolean;
  /** Enable scroll-wheel zoom. Defaults to `showTooltip` so non-interactive example charts stay static. */
  zoomable?: boolean;
  /**
   * When set (unix seconds of the transaction's broadcast/inclusion time), the X
   * axis shows absolute dates (baseTime + elapsed) instead of relative elapsed
   * time — used by the Full History graph so it reads in real dates.
   */
  xBaseTime?: number;
  emptyMessage?: string;
  /** Axis titles. Defaults to `showTooltip` so the mini example charts stay uncluttered. */
  axisLabels?: boolean;
}

export function ProbabilityChart({
  points,
  color = '#e89a3d',
  height = 300,
  showTooltip = true,
  zoomable = showTooltip,
  xBaseTime,
  emptyMessage = 'No data yet.',
  axisLabels = showTooltip,
}: Props) {
  const xTick = (v: number) =>
    xBaseTime != null ? formatAxisDate(xBaseTime + v) : formatElapsed(v);
  const xTooltip = (l: number) =>
    xBaseTime != null ? formatUtc(xBaseTime + l) : `Elapsed: ${formatElapsed(l)}`;
  // Wrapper element that owns the non-passive wheel listener.
  const containerRef = useRef<HTMLDivElement>(null);
  // Data-x (elapsed_seconds) under the cursor; used as the zoom focus.
  const focusRef = useRef<number | null>(null);
  // Current zoom window, mirrored in a ref so the wheel handler can read it
  // without re-attaching the listener on every zoom step.
  const zoomRef = useRef<[number, number] | null>(null);
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  // Click-drag selection (elapsed_seconds). Refs drive the logic (robust to the
  // synchronous run of down/move/up), state drives the shaded ReferenceArea.
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const dragStartRef = useRef<number | null>(null);
  const dragEndRef = useRef<number | null>(null);

  // Full data range along the X axis. Guarded so hooks stay unconditional even
  // when there are no points (the early-return below handles rendering).
  const hasPoints = points.length > 0;
  const fullMin = hasPoints ? points[0].elapsed_seconds : 0;
  const fullMax = hasPoints ? points[points.length - 1].elapsed_seconds : 0;
  const fullSpan = fullMax - fullMin;
  const step = points.length > 1 ? fullSpan / (points.length - 1) : 0;
  // Minimum visible span so zoom can never collapse to zero.
  const minSpan = Math.max(step * 3, fullSpan * 0.01);

  // Keep the range values the wheel handler reads current across renders
  // (e.g. when live updates append points and extend the range).
  const rangeRef = useRef({ fullMin, fullMax, fullSpan, minSpan });
  useEffect(() => {
    rangeRef.current = { fullMin, fullMax, fullSpan, minSpan };
  }, [fullMin, fullMax, fullSpan, minSpan]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !zoomable) return;

    const handleWheel = (e: WheelEvent) => {
      // React's onWheel is passive and cannot block page scroll, so we own the
      // listener here with { passive: false } and preventDefault ourselves.
      e.preventDefault();

      const { fullMin, fullMax, fullSpan, minSpan } = rangeRef.current;
      if (fullSpan <= 0) return;

      const [lo, hi] = zoomRef.current ?? [fullMin, fullMax];
      const span = hi - lo;
      if (span <= 0) return;

      // Focus on the data point under the cursor; fall back to window center.
      let focus = focusRef.current;
      if (focus == null || focus < lo || focus > hi) {
        focus = (lo + hi) / 2;
      }
      const f = (focus - lo) / span; // focus position within the window, 0..1

      // Wheel up (deltaY < 0) zooms in (shrinks the span); down zooms out.
      const factor = e.deltaY < 0 ? 0.8 : 1 / 0.8;
      let newSpan = span * factor;

      // Zooming out to (or past) the full range means "not zoomed".
      if (newSpan >= fullSpan - 1e-9) {
        if (zoomRef.current !== null) {
          zoomRef.current = null;
          setZoom(null);
        }
        return;
      }

      if (newSpan < minSpan) newSpan = minSpan;

      // Keep the focus point pinned under the cursor.
      let newLo = focus - f * newSpan;
      let newHi = newLo + newSpan;

      // Clamp inside the data range, preserving the span.
      if (newLo < fullMin) {
        newLo = fullMin;
        newHi = newLo + newSpan;
      }
      if (newHi > fullMax) {
        newHi = fullMax;
        newLo = newHi - newSpan;
      }

      const next: [number, number] = [newLo, newHi];
      zoomRef.current = next;
      setZoom(next);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoomable]);

  if (points.length === 0) {
    return <div className="graph-empty">{emptyMessage}</div>;
  }

  const isZoomed = zoomable && zoom !== null;

  const renderTooltip = ({ active, payload, label }: TooltipContentProps) => {
    if (!active || !payload || payload.length === 0) return null;
    const point = payload[0].payload as ProbabilityPoint;
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
        <div>{xTooltip(label as number)}</div>
        <div>
          Double-spend: <strong>{formatProbability(point.probability)}</strong>
        </div>
        {point.confirmations != null && (
          <div>
            Confirmations: <strong>{point.confirmations}</strong>
          </div>
        )}
      </div>
    );
  };

  const resetZoom = () => {
    zoomRef.current = null;
    setZoom(null);
  };

  // Commit a click-drag selection to a zoom window (if it spans enough), then
  // clear the drag. Used on mouse-up and when the cursor leaves mid-drag.
  const commitDrag = () => {
    const s = dragStartRef.current;
    const e = dragEndRef.current;
    dragStartRef.current = null;
    dragEndRef.current = null;
    setDragStart(null);
    setDragEnd(null);
    if (s != null && e != null && Math.abs(e - s) >= minSpan) {
      const next: [number, number] = [Math.min(s, e), Math.max(s, e)];
      zoomRef.current = next;
      setZoom(next);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', userSelect: 'none' }}>
      {isZoomed && (
        <button
          type="button"
          onClick={resetZoom}
          style={{
            position: 'absolute',
            top: 8,
            right: 16,
            zIndex: 2,
            padding: '4px 10px',
            fontSize: 12,
            lineHeight: 1.2,
            color: '#0f172a',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
            cursor: 'pointer',
          }}
        >
          Reset zoom
        </button>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={points}
          margin={{ top: 8, right: 16, bottom: axisLabels ? 20 : 4, left: 4 }}
          onMouseDown={
            zoomable
              ? (state) => {
                  const label = typeof state?.activeLabel === 'number' ? state.activeLabel : focusRef.current;
                  if (typeof label === 'number') {
                    dragStartRef.current = label;
                    dragEndRef.current = null;
                    setDragStart(label);
                    setDragEnd(null);
                  }
                }
              : undefined
          }
          onMouseMove={
            zoomable
              ? (state) => {
                  const label = typeof state?.activeLabel === 'number' ? state.activeLabel : focusRef.current;
                  if (typeof label === 'number') focusRef.current = label;
                  if (dragStartRef.current != null && typeof label === 'number') {
                    dragEndRef.current = label;
                    setDragEnd(label);
                  }
                }
              : undefined
          }
          onMouseUp={zoomable ? commitDrag : undefined}
          onMouseLeave={zoomable ? commitDrag : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          {dragStart != null && dragEnd != null && (
            <ReferenceArea x1={dragStart} x2={dragEnd} strokeOpacity={0.3} fill="#3b82f6" fillOpacity={0.12} />
          )}
          <XAxis
            dataKey="elapsed_seconds"
            type="number"
            domain={zoom ?? ['dataMin', 'dataMax']}
            allowDataOverflow
            tickFormatter={(v) => xTick(v as number)}
            minTickGap={xBaseTime != null ? 60 : 20}
            stroke="#64748b"
            fontSize={12}
            label={
              axisLabels
                ? {
                    value: xBaseTime != null ? 'Date' : 'Time elapsed',
                    position: 'bottom',
                    offset: 0,
                    fill: '#64748b',
                    fontSize: 12,
                  }
                : undefined
            }
          />
          <YAxis
            tickFormatter={(v) => formatProbability(v as number)}
            stroke="#64748b"
            fontSize={12}
            width={axisLabels ? 88 : 72}
            domain={[0, 'auto']}
            label={
              axisLabels
                ? {
                    value: 'Double-spend probability',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 4,
                    style: { textAnchor: 'middle' },
                    fill: '#64748b',
                    fontSize: 12,
                  }
                : undefined
            }
          />
          {showTooltip && <Tooltip content={renderTooltip} />}
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
    </div>
  );
}

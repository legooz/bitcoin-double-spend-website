"""Largest-Triangle-Three-Buckets (LTTB) downsampling.

The history graphs can contain tens of thousands of points. LTTB reduces them
to a few hundred while preserving the visual shape of the curve, so the chart
stays responsive without lying about the data. Ported from the original worker.
"""
from __future__ import annotations

Point = tuple[float, float]


def choose_threshold(point_count: int, requested: int | None = None) -> int:
    if point_count <= 2:
        return point_count
    if requested is not None:
        return max(3, min(requested, point_count))
    if point_count <= 100:
        return point_count
    if point_count <= 500:
        return 100
    if point_count <= 2_000:
        return 250
    if point_count <= 10_000:
        return 500
    return 1_000


def _triangle_area(ax: float, ay: float, bx: float, by: float, cx: float, cy: float) -> float:
    return abs((ax - cx) * (by - ay) - (ax - bx) * (cy - ay)) / 2


def downsample(points: list[Point], threshold: int) -> list[Point]:
    n = len(points)
    if not points:
        return []
    if threshold >= n or threshold < 3:
        return list(points)

    sampled: list[Point] = [points[0]]
    bucket_size = (n - 2) / (threshold - 2)
    anchor = 0

    for i in range(threshold - 2):
        avg_start = int((i + 1) * bucket_size) + 1
        avg_end = min(int((i + 2) * bucket_size) + 1, n)
        avg_bucket = points[avg_start:avg_end]
        if avg_bucket:
            avg_x = sum(p[0] for p in avg_bucket) / len(avg_bucket)
            avg_y = sum(p[1] for p in avg_bucket) / len(avg_bucket)
        else:
            avg_x, avg_y = points[-1]

        cur_start = int(i * bucket_size) + 1
        cur_end = min(int((i + 1) * bucket_size) + 1, n - 1)

        ax, ay = points[anchor]
        best_area, next_anchor = -1.0, cur_start
        for j in range(cur_start, cur_end):
            area = _triangle_area(ax, ay, points[j][0], points[j][1], avg_x, avg_y)
            if area > best_area:
                best_area, next_anchor = area, j

        sampled.append(points[next_anchor])
        anchor = next_anchor

    sampled.append(points[-1])
    return sampled

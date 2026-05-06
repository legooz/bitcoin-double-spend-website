from typing import Dict, List


Point = Dict[str, float]


def _triangle_area(ax, ay, bx, by, cx, cy):
    return abs((ax - cx) * (by - ay) - (ax - bx) * (cy - ay)) / 2


def choose_lod_threshold(point_count: int, requested_threshold: int | None = None) -> int:
    if point_count <= 2:
        return point_count

    if requested_threshold is not None:
        return max(3, min(requested_threshold, point_count))

    if point_count <= 100:
        return point_count
    if point_count <= 500:
        return 100
    if point_count <= 2_000:
        return 250
    if point_count <= 10_000:
        return 500
    return 1_000


def downsample_lttb(points: List[Point], threshold: int) -> List[Point]:
    if not points:
        return []
    if threshold >= len(points) or threshold < 3:
        return points[:]

    sampled = [points[0]]
    bucket_size = (len(points) - 2) / (threshold - 2)
    a = 0

    for i in range(threshold - 2):
        avg_start = int((i + 1) * bucket_size) + 1
        avg_end = min(int((i + 2) * bucket_size) + 1, len(points))

        avg_bucket = points[avg_start:avg_end]
        if avg_bucket:
            avg_x = sum(p["x"] for p in avg_bucket) / len(avg_bucket)
            avg_y = sum(p["y"] for p in avg_bucket) / len(avg_bucket)
        else:
            avg_x, avg_y = points[-1]["x"], points[-1]["y"]

        cur_start = int(i * bucket_size) + 1
        cur_end = min(int((i + 1) * bucket_size) + 1, len(points) - 1)

        anchor = points[a]
        best_area, next_a = -1.0, cur_start

        for j in range(cur_start, cur_end):
            area = _triangle_area(
                anchor["x"], anchor["y"],
                points[j]["x"], points[j]["y"],
                avg_x, avg_y,
            )
            if area > best_area:
                best_area, next_a = area, j

        sampled.append(points[next_a])
        a = next_a

    sampled.append(points[-1])
    return sampled
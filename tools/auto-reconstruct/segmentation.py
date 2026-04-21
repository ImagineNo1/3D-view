import argparse
import json
from pathlib import Path
import cv2
import numpy as np


def meters_per_pixel(lat: float, zoom: int) -> float:
    return 156543.03392 * np.cos(np.deg2rad(lat)) / (2 ** zoom)


def contour_to_polygon(contour):
    return [[float(p[0][0]), float(p[0][1])] for p in contour]


def simplifyContours(polygons, epsilon=2.5):
    result = []
    for poly in polygons:
        if len(poly) < 4:
            continue
        arr = np.array(poly, dtype=np.float32).reshape((-1, 1, 2))
        approx = cv2.approxPolyDP(arr, epsilon, True)
        if len(approx) < 4:
            continue
        result.append(contour_to_polygon(approx))
    return result


def segmentRoads(image):
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    low_sat = cv2.inRange(hsv, (0, 0, 80), (179, 55, 220))
    linear = cv2.Canny(gray, 40, 120)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 5))
    linear_closed = cv2.morphologyEx(linear, cv2.MORPH_CLOSE, kernel, iterations=1)
    road_mask = cv2.bitwise_and(low_sat, linear_closed)
    road_mask = cv2.dilate(road_mask, np.ones((5, 5), np.uint8), iterations=2)
    cnts, _ = cv2.findContours(road_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    roads = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        ratio = max(w, h) / max(1, min(w, h))
        if (w < 10 and h < 10) or ratio < 2.2:
            continue
        roads.append(c)
    return road_mask, roads


def segmentBuildings(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    smooth = cv2.bilateralFilter(gray, 11, 75, 75)
    edges = cv2.Canny(smooth, 60, 160)
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=2)
    cnts, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    buildings = []
    for c in cnts:
        area = cv2.contourArea(c)
        if area < 180:
            continue
        perimeter = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * perimeter, True)
        if len(approx) < 4:
            continue
        buildings.append(approx)
    return buildings


def estimate_shadow_height(image, contour, scale_m_per_px, sun_elevation_deg=35.0):
    mask = np.zeros(image.shape[:2], dtype=np.uint8)
    cv2.drawContours(mask, [contour], -1, 255, thickness=cv2.FILLED)
    x, y, w, h = cv2.boundingRect(contour)
    pad = 60
    x0 = max(0, x - pad)
    y0 = max(0, y - pad)
    x1 = min(image.shape[1], x + w + pad)
    y1 = min(image.shape[0], y + h + pad)
    roi = image[y0:y1, x0:x1]
    roi_mask = mask[y0:y1, x0:x1]

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    val = hsv[:, :, 2]
    shadow = cv2.inRange(val, 0, 65)
    shadow = cv2.morphologyEx(shadow, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)
    shadow = cv2.bitwise_and(shadow, cv2.bitwise_not(roi_mask))

    ys, xs = np.where(shadow > 0)
    if len(xs) < 15:
        return 10.0

    cx = np.mean(xs)
    cy = np.mean(ys)
    pts = np.column_stack((xs, ys))
    dist = np.sqrt((pts[:, 0] - cx) ** 2 + (pts[:, 1] - cy) ** 2)
    shadow_len_px = float(np.percentile(dist, 90))

    shadow_len_m = shadow_len_px * scale_m_per_px
    height = shadow_len_m * np.tan(np.deg2rad(sun_elevation_deg))
    return float(np.clip(height, 5.0, 70.0))


def remove_road_overlaps(buildings, road_mask):
    filtered = []
    for c in buildings:
        mask = np.zeros(road_mask.shape, dtype=np.uint8)
        cv2.drawContours(mask, [c], -1, 255, thickness=cv2.FILLED)
        inter = cv2.countNonZero(cv2.bitwise_and(mask, road_mask))
        area = cv2.countNonZero(mask)
        if area == 0:
            continue
        if inter / area > 0.18:
            continue
        filtered.append(c)
    return filtered


def save_geojson_like(polygons, out_path):
    payload = []
    for idx, poly in enumerate(polygons):
        payload.append({'id': idx, 'polygon': poly})
    out_path.write_text(json.dumps(payload, indent=2), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', required=True)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--lat', type=float, required=True)
    parser.add_argument('--lng', type=float, required=True)
    parser.add_argument('--zoom', type=int, default=19)
    args = parser.parse_args()

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    image = cv2.imread(args.image)
    if image is None:
      raise RuntimeError('Failed to read satellite image')

    road_mask, road_contours = segmentRoads(image)
    building_contours = segmentBuildings(image)
    building_contours = remove_road_overlaps(building_contours, road_mask)

    building_polys = [contour_to_polygon(c) for c in building_contours]
    road_polys = [contour_to_polygon(c) for c in road_contours]
    building_polys = simplifyContours(building_polys)
    road_polys = simplifyContours(road_polys)

    scale = meters_per_pixel(args.lat, args.zoom)
    with_height = []
    for idx, c in enumerate(building_contours):
        height = estimate_shadow_height(image, c, scale)
        footprint = contour_to_polygon(c)
        with_height.append({'id': idx, 'polygon': footprint, 'height_m': height})

    save_geojson_like(building_polys, out_dir / 'footprints.json')
    save_geojson_like(road_polys, out_dir / 'roads.json')
    (out_dir / 'footprints_with_height.json').write_text(json.dumps(with_height, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()

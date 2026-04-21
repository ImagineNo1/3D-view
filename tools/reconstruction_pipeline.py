import argparse
import json
from dataclasses import dataclass
from pathlib import Path
import cv2
import numpy as np

@dataclass
class TierConfig:
    tier: str
    depth_resolution: int
    segmentation_resolution: int
    max_texture: int


def detect_tier(device_score: float, webgpu: bool, mobile: bool) -> TierConfig:
    if mobile or device_score <= 8:
        return TierConfig('mobile', 256, 256, 2048)
    if webgpu and device_score >= 18:
        return TierConfig('gpu', 1024, 1024, 4096)
    return TierConfig('extreme', 1536, 1536, 8192)


def estimate_depth(image: np.ndarray, resolution: int) -> np.ndarray:
    resized = cv2.resize(image, (resolution, resolution), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    depth = cv2.bilateralFilter(gray, 7, 40, 40)
    return cv2.normalize(depth, None, 0, 255, cv2.NORM_MINMAX)


def semantic_segmentation(image: np.ndarray, resolution: int) -> np.ndarray:
    resized = cv2.resize(image, (resolution, resolution), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    windows = cv2.inRange(hsv, (90, 20, 20), (135, 255, 255))
    balconies = cv2.inRange(hsv, (10, 20, 20), (35, 255, 255))
    columns = cv2.inRange(hsv, (0, 0, 135), (180, 80, 255))
    seg = np.dstack([columns, balconies, windows])
    return seg


def edge_enhance(image: np.ndarray, resolution: int) -> np.ndarray:
    resized = cv2.resize(image, (resolution, resolution), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 60, 180)
    return cv2.GaussianBlur(edges, (3, 3), 0)


def run_pipeline(input_paths: list[Path], output_dir: Path, tier: TierConfig):
    output_dir.mkdir(parents=True, exist_ok=True)
    fused_depth = None
    fused_seg = None
    fused_edge = None
    count = 0

    for path in input_paths:
        image = cv2.imread(str(path))
        if image is None:
            continue
        depth = estimate_depth(image, tier.depth_resolution)
        seg = semantic_segmentation(image, tier.segmentation_resolution)
        edge = edge_enhance(image, tier.segmentation_resolution)

        if fused_depth is None:
            fused_depth = depth.astype(np.float32)
            fused_seg = seg.astype(np.float32)
            fused_edge = edge.astype(np.float32)
        else:
            fused_depth += depth
            fused_seg += seg
            fused_edge += edge
        count += 1

    if count == 0:
        raise RuntimeError('No valid input images')

    fused_depth = (fused_depth / count).astype(np.uint8)
    fused_seg = (fused_seg / count).astype(np.uint8)
    fused_edge = (fused_edge / count).astype(np.uint8)

    cv2.imwrite(str(output_dir / 'depth_fused.png'), fused_depth)
    cv2.imwrite(str(output_dir / 'semantic_fused.png'), fused_seg)
    cv2.imwrite(str(output_dir / 'edge_fused.png'), fused_edge)

    meta = {
        'tier': tier.tier,
        'depth_resolution': tier.depth_resolution,
        'segmentation_resolution': tier.segmentation_resolution,
        'max_texture': tier.max_texture,
        'inputs': [str(p) for p in input_paths],
    }
    (output_dir / 'pipeline.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', nargs='+', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--device-score', type=float, default=12)
    parser.add_argument('--webgpu', action='store_true')
    parser.add_argument('--mobile', action='store_true')
    args = parser.parse_args()

    tier = detect_tier(args.device_score, args.webgpu, args.mobile)
    inputs = [Path(p) for p in args.input]
    output = Path(args.output)
    run_pipeline(inputs, output, tier)


if __name__ == '__main__':
    main()

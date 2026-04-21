import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';

function safeNumber(v, fallback = 0) {
  return Number.isFinite(v) ? v : fallback;
}

export function imageToWorld(x, y, width, height, worldSize) {
  const w = Math.max(1, safeNumber(width, 1));
  const h = Math.max(1, safeNumber(height, 1));
  const size = Math.max(1, safeNumber(worldSize, 700));
  return {
    x: ((safeNumber(x, 0) / w) - 0.5) * size,
    z: ((safeNumber(y, 0) / h) - 0.5) * size
  };
}

function normalizePolygon(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    return [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  }
  const cleaned = polygon
    .map((pt) => Array.isArray(pt) && pt.length >= 2 ? [safeNumber(pt[0], 0), safeNumber(pt[1], 0)] : [0, 0])
    .filter((pt) => Number.isFinite(pt[0]) && Number.isFinite(pt[1]));

  if (cleaned.length < 3) {
    return [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  }
  if (cleaned[0][0] !== cleaned[cleaned.length - 1][0] || cleaned[0][1] !== cleaned[cleaned.length - 1][1]) {
    cleaned.push([...cleaned[0]]);
  }
  return cleaned;
}

export function polygonToShape(polygon, imgWidth, imgHeight, worldSize) {
  const normalized = normalizePolygon(polygon);
  const pts = normalized.map(([x, y]) => imageToWorld(x, y, imgWidth, imgHeight, worldSize));
  const shape = new THREE.Shape();
  pts.forEach((p, i) => {
    if (i === 0) shape.moveTo(p.x, p.z);
    else shape.lineTo(p.x, p.z);
  });
  shape.closePath();
  return shape;
}

export function createExtrudedBuilding({ polygon, height_m }, opts) {
  const h = Math.max(2, safeNumber(height_m, 12));
  const shape = polygonToShape(polygon, opts.imageWidth, opts.imageHeight, opts.worldSize);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
    steps: 1
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, h, 0);
  const material = opts.material || new THREE.MeshStandardMaterial({ color: 0xbfc4cc, roughness: 0.9, metalness: 0.05 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function defaultFootprints() {
  return [
    {
      id: 'fallback-0',
      polygon: [[180, 180], [330, 180], [330, 330], [180, 330], [180, 180]],
      height_m: 16
    },
    {
      id: 'fallback-1',
      polygon: [[390, 280], [510, 280], [510, 390], [390, 390], [390, 280]],
      height_m: 24
    }
  ];
}

export function buildSurroundingMeshes(footprintsWithHeight, opts) {
  const group = new THREE.Group();
  const items = Array.isArray(footprintsWithHeight) && footprintsWithHeight.length
    ? footprintsWithHeight
    : defaultFootprints();

  for (const fp of items) {
    group.add(createExtrudedBuilding(fp, opts));
  }

  if (group.children.length === 0) {
    for (const fp of defaultFootprints()) {
      group.add(createExtrudedBuilding(fp, opts));
    }
  }

  return group;
}

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

async function writeGeoDebug(payload) {
  try {
    if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile('/tmp/geo-debug.json', JSON.stringify(payload, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('[geo] failed to write /tmp/geo-debug.json', err);
  }
}

export function buildSurroundingMeshes(footprintsWithHeight, opts) {
  const group = new THREE.Group();
  try {
    const source = Array.isArray(footprintsWithHeight) ? footprintsWithHeight : [];
    console.log(`[geo] input polygons count=${source.length}`);
    const coords = source.flatMap((fp) => Array.isArray(fp?.polygon) ? fp.polygon : []);
    const xs = coords.map((p) => Number(p?.[0])).filter(Number.isFinite);
    const ys = coords.map((p) => Number(p?.[1])).filter(Number.isFinite);
    const minLat = ys.length ? Math.min(...ys) : null;
    const maxLat = ys.length ? Math.max(...ys) : null;
    const minLng = xs.length ? Math.min(...xs) : null;
    const maxLng = xs.length ? Math.max(...xs) : null;
    console.log(`[geo] min/max lat=${minLat}/${maxLat} lng=${minLng}/${maxLng}`);

    const items = source.length ? source : defaultFootprints();

    for (const fp of items) {
      group.add(createExtrudedBuilding(fp, opts));
    }

    if (group.children.length === 0) {
      for (const fp of defaultFootprints()) {
        group.add(createExtrudedBuilding(fp, opts));
      }
    }

    console.log(`[geo] output building footprints count=${group.children.length}`);
    return group;
  } catch (err) {
    const message = err?.stack || err?.message || String(err);
    console.error('[geo] error in buildSurroundingMeshes');
    console.error(message);
    writeGeoDebug({
      error: message
    });
    for (const fp of defaultFootprints()) {
      group.add(createExtrudedBuilding(fp, opts));
    }
    return group;
  }
}

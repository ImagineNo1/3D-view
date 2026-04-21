import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';

export function imageToWorld(x, y, width, height, worldSize) {
  return {
    x: ((x / width) - 0.5) * worldSize,
    z: ((y / height) - 0.5) * worldSize
  };
}

export function polygonToShape(polygon, imgWidth, imgHeight, worldSize) {
  const pts = polygon.map(([x, y]) => imageToWorld(x, y, imgWidth, imgHeight, worldSize));
  const shape = new THREE.Shape();
  pts.forEach((p, i) => {
    if (i === 0) shape.moveTo(p.x, p.z);
    else shape.lineTo(p.x, p.z);
  });
  shape.closePath();
  return shape;
}

export function createExtrudedBuilding({ polygon, height_m }, opts) {
  const shape = polygonToShape(polygon, opts.imageWidth, opts.imageHeight, opts.worldSize);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height_m,
    bevelEnabled: false,
    steps: 1
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, height_m, 0);
  const material = opts.material || new THREE.MeshStandardMaterial({ color: 0xbfc4cc, roughness: 0.9, metalness: 0.05 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildSurroundingMeshes(footprintsWithHeight, opts) {
  const group = new THREE.Group();
  for (const fp of footprintsWithHeight) {
    group.add(createExtrudedBuilding(fp, opts));
  }
  return group;
}

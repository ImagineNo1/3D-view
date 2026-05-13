import * as THREE from 'three';
import type { Estate3DConfig } from './types';
import { loadOptionalTexture } from './textureUtils';

export type BuildingDimensions = { width: number; depth: number; height: number; floors: number; floorHeight: number };

export function resolveBuildingDimensions(config: Estate3DConfig): BuildingDimensions {
  const floors = Math.max(1, Math.round(config.floors || (config.buildingHeight && config.floorHeight ? config.buildingHeight / config.floorHeight : 4)));
  const floorHeight = Math.max(2.4, config.floorHeight || (config.buildingHeight ? config.buildingHeight / floors : 3));
  const height = Math.max(3, config.buildingHeight || floors * floorHeight);
  const area = Math.max(20, config.buildingArea || 144);
  const estimatedWidth = Math.sqrt(area * 0.7);
  const estimatedDepth = area / estimatedWidth;
  return {
    width: Math.max(4, config.footprintWidth || estimatedWidth),
    depth: Math.max(4, config.footprintDepth || estimatedDepth),
    height,
    floors,
    floorHeight: height / floors
  };
}

function makeNeutralFacadeMaterial(color = '#cbd5e1') {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.05 });
}

function addFloorLines(group: any, dimensions: BuildingDimensions) {
  const material = new THREE.LineBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0.42 });
  const { width, depth, height, floors } = dimensions;
  for (let i = 1; i < floors; i += 1) {
    const y = (height / floors) * i;
    const points = [
      new THREE.Vector3(-width / 2 - 0.025, y, depth / 2 + 0.025),
      new THREE.Vector3(width / 2 + 0.025, y, depth / 2 + 0.025),
      new THREE.Vector3(width / 2 + 0.025, y, -depth / 2 - 0.025),
      new THREE.Vector3(-width / 2 - 0.025, y, -depth / 2 - 0.025),
      new THREE.Vector3(-width / 2 - 0.025, y, depth / 2 + 0.025)
    ];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
    group.add(line);
  }
}

function addProceduralWindows(group: any, dimensions: BuildingDimensions) {
  const windowMaterial = new THREE.MeshStandardMaterial({ color: '#89b4d8', emissive: '#10202d', emissiveIntensity: 0.16, roughness: 0.28, metalness: 0.2 });
  const balconyMaterial = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.55 });
  const { width, depth, height, floors } = dimensions;
  const rows = floors;
  const frontCols = Math.max(2, Math.floor(width / 4));
  const sideCols = Math.max(1, Math.floor(depth / 4));
  const winW = Math.min(1.5, width / (frontCols * 2.2));
  const winH = Math.min(1.5, height / (rows * 2.4));

  const addWindow = (x: number, y: number, z: number, rotY: number, scaleX = winW) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(scaleX, winH), windowMaterial);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    group.add(mesh);
  };

  for (let floor = 0; floor < rows; floor += 1) {
    const y = (floor + 0.55) * (height / rows);
    for (let col = 0; col < frontCols; col += 1) {
      const x = -width / 2 + ((col + 1) * width) / (frontCols + 1);
      addWindow(x, y, depth / 2 + 0.035, 0);
      addWindow(x, y, -depth / 2 - 0.035, Math.PI);
      if (floor > 0 && floor % 2 === 0 && col % 2 === 0) {
        const balcony = new THREE.Mesh(new THREE.BoxGeometry(winW * 1.45, 0.08, 0.55), balconyMaterial);
        balcony.position.set(x, y - winH * 0.62, depth / 2 + 0.32);
        group.add(balcony);
      }
    }
    for (let col = 0; col < sideCols; col += 1) {
      const z = -depth / 2 + ((col + 1) * depth) / (sideCols + 1);
      addWindow(width / 2 + 0.035, y, z, Math.PI / 2, Math.min(1.25, depth / (sideCols * 2.2)));
      addWindow(-width / 2 - 0.035, y, z, -Math.PI / 2, Math.min(1.25, depth / (sideCols * 2.2)));
    }
  }
}

export async function createParametricBuilding(config: Estate3DConfig, renderer?: any) {
  const dimensions = resolveBuildingDimensions(config);
  const group = new THREE.Group();
  group.name = 'parametric-building';
  group.rotation.y = THREE.MathUtils.degToRad(config.rotationDeg || 0);

  const [rightTex, leftTex, roofTex, bottomTex, frontTex, backTex] = await Promise.all([
    loadOptionalTexture(config.facadeRightUrl, renderer),
    loadOptionalTexture(config.facadeLeftUrl, renderer),
    Promise.resolve(null),
    Promise.resolve(null),
    loadOptionalTexture(config.facadeFrontUrl, renderer),
    loadOptionalTexture(config.facadeBackUrl, renderer)
  ]);

  const materials: any[] = [
    rightTex ? new THREE.MeshStandardMaterial({ map: rightTex, roughness: 0.65 }) : makeNeutralFacadeMaterial('#cbd5e1'),
    leftTex ? new THREE.MeshStandardMaterial({ map: leftTex, roughness: 0.65 }) : makeNeutralFacadeMaterial('#cbd5e1'),
    roofTex ? new THREE.MeshStandardMaterial({ map: roofTex }) : new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.82 }),
    bottomTex ? new THREE.MeshStandardMaterial({ map: bottomTex }) : new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.9 }),
    frontTex ? new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.65 }) : makeNeutralFacadeMaterial('#dbe4ee'),
    backTex ? new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.65 }) : makeNeutralFacadeMaterial('#c7d2df')
  ];

  const body = new THREE.Mesh(new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth), materials);
  body.position.y = dimensions.height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const edgeLines = new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry), new THREE.LineBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0.42 }));
  edgeLines.position.copy(body.position);
  group.add(edgeLines);

  addFloorLines(group, dimensions);
  if (!frontTex && !backTex && !leftTex && !rightTex) addProceduralWindows(group, dimensions);

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 1024;
  labelCanvas.height = 256;
  const ctx = labelCanvas.getContext('2d');
  if (ctx && config.title) {
    ctx.fillStyle = 'rgba(15,23,42,0.82)';
    ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.title.slice(0, 32), labelCanvas.width / 2, labelCanvas.height / 2);
    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    label.position.set(0, dimensions.height + 2.5, dimensions.depth / 2 + 1);
    label.scale.set(Math.min(dimensions.width, 28), Math.min(dimensions.width, 28) / 4, 1);
    group.add(label);
  }

  return { object: group, dimensions };
}

export async function createGround(config: Estate3DConfig, size: number, renderer?: any) {
  const aerialTexture = await loadOptionalTexture(config.aerialImageUrl, renderer);
  const material = aerialTexture
    ? new THREE.MeshStandardMaterial({ map: aerialTexture, roughness: 0.95 })
    : new THREE.MeshStandardMaterial({ color: '#293847', roughness: 0.9 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

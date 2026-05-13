import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Estate3DConfig } from './types';
import { resolveBuildingDimensions } from './ParametricBuilding';

export function isLikelyGltfUrl(url?: string) {
  return Boolean(url && /\.(glb|gltf)(?:$|[?#])/i.test(url));
}

export async function loadEstateModel(config: Estate3DConfig) {
  if (!isLikelyGltfUrl(config.modelUrl)) throw new Error('Model URL must point to a .glb or .gltf file.');
  const gltf = await new GLTFLoader().loadAsync(config.modelUrl!);
  const root = gltf.scene;
  root.name = 'estate-custom-model';
  root.traverse((child: any) => {
    const mesh = child as any;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  root.position.sub(center);

  const target = resolveBuildingDimensions(config);
  const targetHeight = target.height;
  const targetFootprint = Math.max(target.width, target.depth);
  const currentHeight = size.y || Math.max(size.x, size.z) || 1;
  const currentFootprint = Math.max(size.x, size.z) || currentHeight;
  const heightScale = targetHeight / currentHeight;
  const footprintScale = targetFootprint / currentFootprint;
  const scale = Number.isFinite(heightScale) && Number.isFinite(footprintScale) ? Math.min(heightScale, footprintScale) : 1;
  root.scale.setScalar(Math.max(0.01, scale));

  const scaledBox = new THREE.Box3().setFromObject(root);
  root.position.y -= scaledBox.min.y;
  root.rotation.y = THREE.MathUtils.degToRad(config.rotationDeg || 0);

  return { object: root, dimensions: target };
}

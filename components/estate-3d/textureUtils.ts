import * as THREE from 'three';

export async function loadOptionalTexture(url: string | undefined, renderer?: any): Promise<any | null> {
  if (!url) return null;
  try {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = renderer?.capabilities.getMaxAnisotropy() ?? 4;
    texture.needsUpdate = true;
    return texture;
  } catch (error) {
    console.warn('Texture failed to load', { url, error });
    return null;
  }
}

export function disposeMaterial(material: any) {
  const materials = Array.isArray(material) ? material : [material];
  for (const item of materials) {
    for (const value of Object.values(item) as any[]) {
      if (value instanceof THREE.Texture) value.dispose();
    }
    item.dispose();
  }
}

export function disposeObject3D(object: any) {
  object.traverse((child: any) => {
    const mesh = child as any;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) disposeMaterial(mesh.material);
  });
}

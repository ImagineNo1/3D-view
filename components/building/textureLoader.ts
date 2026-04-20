import * as THREE from 'three';
import type { FacadeAssets } from './generators';

export function loadTexture(loader: any, url?: string | null): Promise<any> {
  if (!url) return Promise.resolve(null);

  return new Promise((resolve) => {
    loader.load(
      url,
      (texture: any) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        resolve(texture);
      },
      undefined,
      () => resolve(null)
    );
  });
}

export async function loadBuildingTextures(loader: any, assets: FacadeAssets) {
  const [groundTexture, rightTexture, leftTexture, frontTexture, backTexture] = await Promise.all([
    loadTexture(loader, assets.aerialImage),
    loadTexture(loader, assets.facadeRight),
    loadTexture(loader, assets.facadeLeft),
    loadTexture(loader, assets.facadeFront),
    loadTexture(loader, assets.facadeBack)
  ]);

  return { groundTexture, rightTexture, leftTexture, frontTexture, backTexture };
}

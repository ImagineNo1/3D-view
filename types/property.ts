export type PropertyImages = {
  gallery: string[];
  aerial: string[];
};



export type BuildingAppearance = {
  buildingType?: 'residential' | 'commercial' | 'office' | 'villa' | 'mixed_use';
  facadeMode?: 'image' | 'procedural' | 'hybrid';
  primaryMaterial?: 'stone' | 'brick' | 'cement' | 'glass' | 'composite' | 'paint';
  secondaryMaterial?: 'stone' | 'brick' | 'cement' | 'glass' | 'composite' | 'paint';
  primaryColor?: string; secondaryColor?: string; roofType?: 'flat' | 'gable' | 'parapet'; roofColor?: string;
  entranceSide?: 'front' | 'back' | 'left' | 'right'; entranceWidth?: number; entranceHeight?: number; groundFloorHeight?: number;
  windowStyle?: 'grid' | 'modern' | 'vertical' | 'strip'; windowColsFront?: number; windowColsBack?: number; windowColsLeft?: number; windowColsRight?: number;
  windowRows?: number; windowWidth?: number; windowHeight?: number; balconySides?: ('front'|'back'|'left'|'right')[]; balconyEveryNFloor?: number; balconyDepth?: number;
  cornerChamfer?: boolean; parapetHeight?: number;
};

export type SiteContext = {
  contextMode?: 'manual' | 'osm' | 'hybrid'; environmentPreset?: 'dense_urban' | 'urban_street' | 'suburban' | 'villa' | 'commercial_strip';
  lotWidth?: number; lotDepth?: number; setbackFront?: number; setbackBack?: number; setbackLeft?: number; setbackRight?: number; siteRotationDeg?: number;
  roadSides?: ('front'|'back'|'left'|'right')[]; roadWidthFront?: number; roadWidthBack?: number; roadWidthLeft?: number; roadWidthRight?: number; sidewalkWidth?: number;
  addFence?: boolean; fenceType?: 'none' | 'metal' | 'wall' | 'hedge'; addGate?: boolean; gateSide?: 'front'|'back'|'left'|'right';
  treeCount?: number; shrubCount?: number; parkingCount?: number; addStreetLights?: boolean; neighborMode?: 'none'|'simple'|'custom'; neighborCount?: number;
};


export type AerialContext = { aerialImageUrl?: string; aerialSource?: 'google_maps_screenshot'|'drone'|'licensed_orthophoto'|'osm'|'other'; aerialAttribution?: string; aerialImageWidthPx?: number; aerialImageHeightPx?: number; aerialWidthMeters?: number; aerialDepthMeters?: number; aerialMetersPerPixel?: number; aerialRotationDeg?: number; aerialScaleReference?: { p1:{x:number;y:number}; p2:{x:number;y:number}; distanceMeters:number }; buildingFootprintImagePoints?: [{x:number;y:number},{x:number;y:number},{x:number;y:number},{x:number;y:number}]; lotPolygonImagePoints?: {x:number;y:number}[]; allowProceduralFallback?: boolean; };
export type FacadePhotoCalibration = { imageUrl?: string; sourceCorners?: [{x:number;y:number},{x:number;y:number},{x:number;y:number},{x:number;y:number}]; fitMode?: 'stretch'|'cover'|'contain'; flipX?: boolean; flipY?: boolean; rotationDeg?: number; rectifiedImageUrl?: string; };
export type RealFacadeTextures = { facadeFront?: FacadePhotoCalibration; facadeBack?: FacadePhotoCalibration; facadeLeft?: FacadePhotoCalibration; facadeRight?: FacadePhotoCalibration; facadeApplicationMode?: 'raw'|'calibrated'|'hybrid'; };
export type ViewerRealismMode = { sceneMode?: 'procedural'|'real_aerial'|'real_aerial_with_osm'|'mixed'; disableFakeSurroundings?: boolean; disableProceduralFacadeDetailsWhenPhotosExist?: boolean; };

export type PropertyPayload = {
  title: string;
  description: string;
  googleMapsUrl?: string;
  images: PropertyImages;
  buildingArea?: number;
  buildingHeight?: number;
  floorCount?: number;
  floorHeight?: number;
  rotation?: number;
  modelUrl?: string;
  footprintWidth?: number;
  footprintDepth?: number;
  buildingAppearance?: BuildingAppearance;
  siteContext?: SiteContext;
  aerialContext?: AerialContext;
  realFacadeTextures?: RealFacadeTextures;
  viewerRealismMode?: ViewerRealismMode;
};

export type Property = PropertyPayload & {
  _id: string;
  slug: string;
  latitude?: number;
  longitude?: number;
  qrCodeDataUrl: string;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
};

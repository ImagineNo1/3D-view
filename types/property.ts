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

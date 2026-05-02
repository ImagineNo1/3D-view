export type PropertyImages = {
  gallery: string[];
  aerial: string[];
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

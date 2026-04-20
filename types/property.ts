export type LatLngPoint = {
  lat: number;
  lng: number;
};

export type ViewerHotspot = {
  label: string;
  description: string;
  x: number;
  y: number;
};

export type PropertyImages = {
  gallery: string[];
  aerial: string[];
};

export type PropertyPayload = {
  title: string;
  description: string;
  googleMapsUrl?: string;
  images: PropertyImages;
  hotspots?: ViewerHotspot[];
  boundary?: LatLngPoint[];
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

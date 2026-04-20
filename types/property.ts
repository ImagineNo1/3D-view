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

export type PropertyPayload = {
  title: string;
  description: string;
  images: string[];
  location?: string;
  googleMapsUrl?: string;
  satelliteImageUrl?: string;
  latitude?: number;
  longitude?: number;
  boundary?: LatLngPoint[];
  hotspots?: ViewerHotspot[];
};

export type Property = PropertyPayload & {
  _id: string;
  slug: string;
  qrCodeDataUrl: string;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
};

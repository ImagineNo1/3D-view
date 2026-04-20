export type PropertyPayload = {
  title: string;
  description: string;
  images: string[];
  location?: string;
  googleMapsUrl?: string;
  satelliteImageUrl?: string;
};

export type Property = PropertyPayload & {
  _id: string;
  slug: string;
  qrCodeDataUrl: string;
  publicUrl: string;
  createdAt: string;
  updatedAt: string;
};

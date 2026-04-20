import mongoose, { Model, Schema } from 'mongoose';

interface ILatLngPoint {
  lat: number;
  lng: number;
}

interface IViewerHotspot {
  label: string;
  description: string;
  x: number;
  y: number;
}

export interface IProperty {
  title: string;
  description: string;
  images: string[];
  location?: string;
  googleMapsUrl?: string;
  satelliteImageUrl?: string;
  latitude?: number;
  longitude?: number;
  boundary: ILatLngPoint[];
  hotspots: IViewerHotspot[];
  slug: string;
  qrCodeDataUrl: string;
  publicUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const LatLngSchema = new Schema<ILatLngPoint>(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  { _id: false }
);

const HotspotSchema = new Schema<IViewerHotspot>(
  {
    label: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true }
  },
  { _id: false }
);

const PropertySchema = new Schema<IProperty>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    location: { type: String, trim: true },
    googleMapsUrl: { type: String, trim: true },
    satelliteImageUrl: { type: String, trim: true },
    latitude: { type: Number },
    longitude: { type: Number },
    boundary: { type: [LatLngSchema], default: [] },
    hotspots: { type: [HotspotSchema], default: [] },
    slug: { type: String, required: true, unique: true, index: true },
    qrCodeDataUrl: { type: String, required: true },
    publicUrl: { type: String, required: true }
  },
  { timestamps: true }
);

const Property = (mongoose.models.Property as Model<IProperty>) || mongoose.model<IProperty>('Property', PropertySchema);

export default Property;

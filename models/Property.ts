import mongoose, { Model, Schema } from 'mongoose';

interface IPropertyImages {
  gallery: string[];
  aerial: string[];
}

export interface IProperty {
  title: string;
  description: string;
  googleMapsUrl?: string;
  images: IPropertyImages;
  latitude?: number;
  longitude?: number;
  slug: string;
  qrCodeDataUrl: string;
  publicUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

const PropertySchema = new Schema<IProperty>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    googleMapsUrl: { type: String, trim: true },
    images: {
      gallery: { type: [String], default: [] },
      aerial: { type: [String], default: [] }
    },
    latitude: { type: Number },
    longitude: { type: Number },
    slug: { type: String, required: true, unique: true, index: true },
    qrCodeDataUrl: { type: String, required: true },
    publicUrl: { type: String, required: true }
  },
  { timestamps: true }
);

const Property = (mongoose.models.Property as Model<IProperty>) || mongoose.model<IProperty>('Property', PropertySchema);

export default Property;

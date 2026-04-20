import mongoose, { Model, Schema } from 'mongoose';

export interface IProperty {
  title: string;
  description: string;
  images: string[];
  modelUrl: string;
  location?: string;
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
    images: { type: [String], default: [] },
    modelUrl: { type: String, required: true, trim: true },
    location: { type: String, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    qrCodeDataUrl: { type: String, required: true },
    publicUrl: { type: String, required: true }
  },
  { timestamps: true }
);

const Property = (mongoose.models.Property as Model<IProperty>) || mongoose.model<IProperty>('Property', PropertySchema);

export default Property;

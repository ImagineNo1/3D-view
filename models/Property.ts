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
  buildingArea?: number;
  buildingHeight?: number;
  floorCount?: number;
  floorHeight?: number;
  rotation?: number;
  modelUrl?: string;
  footprintWidth?: number;
  footprintDepth?: number;
  buildingAppearance?: Record<string, unknown>;
  siteContext?: Record<string, unknown>;
  aerialContext?: Record<string, unknown>;
  realFacadeTextures?: Record<string, unknown>;
  viewerRealismMode?: Record<string, unknown>;
  latitude?: number;
  longitude?: number;
  cameraAltitude?: number;
  cameraTilt?: number;
  cameraHeading?: number;
  cameraRange?: number;
  viewerMode?: 'three_procedural' | 'google_3d_maps' | 'cesium_google_3d_tiles' | 'real_world_digital_twin' | 'standalone_model' | 'parametric_fallback';
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
    buildingArea: { type: Number },
    buildingHeight: { type: Number },
    floorCount: { type: Number },
    floorHeight: { type: Number },
    rotation: { type: Number },
    modelUrl: { type: String, trim: true },
    footprintWidth: { type: Number },
    footprintDepth: { type: Number },
    buildingAppearance: { type: Schema.Types.Mixed },
    siteContext: { type: Schema.Types.Mixed },
    aerialContext: { type: Schema.Types.Mixed },
    realFacadeTextures: { type: Schema.Types.Mixed },
    viewerRealismMode: { type: Schema.Types.Mixed },
    latitude: { type: Number },
    longitude: { type: Number },
    cameraAltitude: { type: Number, default: 300 },
    cameraTilt: { type: Number, default: 65 },
    cameraHeading: { type: Number, default: 0 },
    cameraRange: { type: Number, default: 300 },
    viewerMode: { type: String, enum: ['three_procedural', 'google_3d_maps', 'cesium_google_3d_tiles', 'real_world_digital_twin', 'standalone_model', 'parametric_fallback'], default: 'parametric_fallback' },
    slug: { type: String, required: true, unique: true, index: true },
    qrCodeDataUrl: { type: String, required: true },
    publicUrl: { type: String, required: true }
  },
  { timestamps: true }
);

const Property = (mongoose.models.Property as Model<IProperty>) || mongoose.model<IProperty>('Property', PropertySchema);

export default Property;

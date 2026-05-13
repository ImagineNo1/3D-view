'use client';

import { Estate3DViewer } from '@/components/estate-3d/Estate3DViewer';
import { propertyToEstate3DConfig } from '@/components/estate-3d/types';
type Props = {
  property: Record<string, any>;
};

export function PropertyPublicViewer({ property }: Props) {
  return <Estate3DViewer config={propertyToEstate3DConfig(property)} />;
}

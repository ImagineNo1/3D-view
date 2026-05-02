'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ImageUploader, normalizeExistingImages, type UploadItem, type UploadStatus } from '@/components/admin/ImageUploader';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { parseGoogleMapsUrl } from '@/lib/maps';
import type { Property, PropertyPayload } from '@/types/property';

type Props = {
  onCreated: (property: Property) => void;
  editing?: Property | null;
  onUpdated?: (property: Property) => void;
  onCancelEdit?: () => void;
};

type UploadResponse = {
  success?: boolean;
  fileUrl?: string;
  urls?: string[];
  error?: string;
  code?: string;
  details?: string;
  requestId?: string;
};

function readUploadError(xhr: XMLHttpRequest, parsed: UploadResponse) {
  const responseType = xhr.getResponseHeader('content-type') || '';
  const responseText = xhr.responseText?.trim();
  const fallback = `Upload failed (status ${xhr.status})`;

  if (parsed.error?.trim()) {
    const codePart = parsed.code ? ` [${parsed.code}]` : '';
    const detailsPart = parsed.details ? ` — ${parsed.details}` : '';
    const requestPart = parsed.requestId ? ` (request: ${parsed.requestId})` : '';
    return `${parsed.error}${codePart}${detailsPart}${requestPart}`;
  }

  if (!responseText) return fallback;
  if (responseType.includes('text/html')) return `${fallback} — server returned HTML instead of JSON`;

  const compact = responseText.replace(/\s+/g, ' ').slice(0, 240);
  return `${fallback} — ${compact}`;
}

async function uploadImageWithProgress(
  category: 'gallery' | 'aerial',
  item: UploadItem,
  propertyKey: string,
  onProgress: (value: number) => void,
  onStatusChange: (status: UploadStatus, message?: string) => void
): Promise<string> {
  if (item.type === 'url' || !item.file) {
    onProgress(100);
    onStatusChange('success');
    return item.url;
  }

  const file = item.file;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onStatusChange('uploading');
      onProgress((event.loaded / event.total) * 100);
    };

    xhr.onload = () => {
      let data: UploadResponse = {};
      try {
        data = JSON.parse(xhr.responseText) as UploadResponse;
      } catch (error) {
        console.error('Upload response parse error', error, xhr.responseText);
      }

      const uploadedUrl = data.fileUrl || data.urls?.[0];
      const hasSuccess = xhr.status >= 200 && xhr.status < 300 && (data.success === true || Boolean(uploadedUrl));

      if (hasSuccess && uploadedUrl) {
        onProgress(100);
        onStatusChange('success');
        resolve(uploadedUrl);
        return;
      }

      const message = readUploadError(xhr, data);
      console.error('Upload rejected', { status: xhr.status, body: xhr.responseText, parsed: data });
      onStatusChange('error', message);
      reject(new Error(message));
    };

    xhr.onerror = () => {
      const message = `Network error while uploading image (status ${xhr.status || 0})`;
      console.error(message, { category, propertyKey, fileName: file.name });
      onStatusChange('error', message);
      reject(new Error(message));
    };

    const formData = new FormData();
    formData.append('category', category);
    formData.append('propertyKey', propertyKey);
    formData.append('files', file);
    xhr.send(formData);
  });
}

export function PropertyForm({ onCreated, editing, onUpdated, onCancelEdit }: Props) {
  const existingFacades = editing?.images.gallery || [];
  const { t } = useLanguage();
  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(editing?.googleMapsUrl || '');
  const [buildingArea, setBuildingArea] = useState(editing?.buildingArea?.toString() || '');
  const [buildingHeight, setBuildingHeight] = useState(editing?.buildingHeight?.toString() || '');
  const [floorCount, setFloorCount] = useState(editing?.floorCount?.toString() || '');
  const [floorHeight, setFloorHeight] = useState(editing?.floorHeight?.toString() || '');
  const [rotation, setRotation] = useState(editing?.rotation?.toString() || '');
  const [modelUrl, setModelUrl] = useState(editing?.modelUrl || '');
  const [footprintWidth, setFootprintWidth] = useState(editing?.footprintWidth?.toString() || '');
  const [footprintDepth, setFootprintDepth] = useState(editing?.footprintDepth?.toString() || '');
  const [environmentPreset, setEnvironmentPreset] = useState(editing?.siteContext?.environmentPreset || 'urban_street');
  const [contextMode, setContextMode] = useState(editing?.siteContext?.contextMode || 'manual');
  const [facadeMode, setFacadeMode] = useState(editing?.buildingAppearance?.facadeMode || 'hybrid');
  const [roofType, setRoofType] = useState(editing?.buildingAppearance?.roofType || 'parapet');
  const [sceneMode, setSceneMode] = useState(editing?.viewerRealismMode?.sceneMode || 'procedural');
  const [aerialImageUrl, setAerialImageUrl] = useState(editing?.aerialContext?.aerialImageUrl || editing?.images?.aerial?.[0] || '');
  const [aerialSource, setAerialSource] = useState(editing?.aerialContext?.aerialSource || 'other');
  const [aerialAttribution, setAerialAttribution] = useState(editing?.aerialContext?.aerialAttribution || '');
  const [aerialWidthMeters, setAerialWidthMeters] = useState(editing?.aerialContext?.aerialWidthMeters?.toString() || '');
  const [aerialDepthMeters, setAerialDepthMeters] = useState(editing?.aerialContext?.aerialDepthMeters?.toString() || '');
  const [metersPerPixel, setMetersPerPixel] = useState(editing?.aerialContext?.aerialMetersPerPixel?.toString() || '');
  const [aerialRotationDeg, setAerialRotationDeg] = useState(editing?.aerialContext?.aerialRotationDeg?.toString() || '');
  const [allowProceduralFallback, setAllowProceduralFallback] = useState(Boolean(editing?.aerialContext?.allowProceduralFallback ?? true));
  const [facadeFrontImages, setFacadeFrontImages] = useState<UploadItem[]>(normalizeExistingImages(existingFacades[0] ? [existingFacades[0]] : []));
  const [facadeBackImages, setFacadeBackImages] = useState<UploadItem[]>(normalizeExistingImages(existingFacades[1] ? [existingFacades[1]] : []));
  const [facadeLeftImages, setFacadeLeftImages] = useState<UploadItem[]>(normalizeExistingImages(existingFacades[2] ? [existingFacades[2]] : []));
  const [facadeRightImages, setFacadeRightImages] = useState<UploadItem[]>(normalizeExistingImages(existingFacades[3] ? [existingFacades[3]] : []));
  const [aerialImages, setAerialImages] = useState<UploadItem[]>(normalizeExistingImages(editing?.images.aerial || []));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressById, setProgressById] = useState<Record<string, number>>({});
  const [statusById, setStatusById] = useState<Record<string, UploadStatus>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const parsedFromUrl = useMemo(() => parseGoogleMapsUrl(googleMapsUrl), [googleMapsUrl]);
  const propertyKey = useMemo(() => editing?._id || `temp-${Date.now()}`, [editing?._id]);

  const parseOptionalNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const payload = (gallery: string[], aerial: string[]): PropertyPayload => ({
    title,
    description,
    googleMapsUrl,
    images: { gallery, aerial },
    buildingArea: parseOptionalNumber(buildingArea),
    buildingHeight: parseOptionalNumber(buildingHeight),
    floorCount: parseOptionalNumber(floorCount),
    floorHeight: parseOptionalNumber(floorHeight),
    rotation: parseOptionalNumber(rotation),
    modelUrl: modelUrl.trim() || undefined,
    footprintWidth: parseOptionalNumber(footprintWidth),
    footprintDepth: parseOptionalNumber(footprintDepth),
    buildingAppearance: { facadeMode, roofType },
    siteContext: { environmentPreset, contextMode },
    aerialContext: { aerialImageUrl, aerialSource, aerialAttribution, aerialWidthMeters: parseOptionalNumber(aerialWidthMeters), aerialDepthMeters: parseOptionalNumber(aerialDepthMeters), aerialMetersPerPixel: parseOptionalNumber(metersPerPixel), aerialRotationDeg: parseOptionalNumber(aerialRotationDeg), allowProceduralFallback },
    realFacadeTextures: { facadeFront: { imageUrl: gallery[0] }, facadeBack: { imageUrl: gallery[1] }, facadeLeft: { imageUrl: gallery[2] }, facadeRight: { imageUrl: gallery[3] }, facadeApplicationMode: "hybrid" },
    viewerRealismMode: { sceneMode, disableFakeSurroundings: true, disableProceduralFacadeDetailsWhenPhotosExist: true }
  });

  const uploadBatch = async (category: 'gallery' | 'aerial', items: UploadItem[]) => {
    const result: string[] = [];
    for (const item of items) {
      if (item.file && !['image/jpeg', 'image/png', 'image/webp'].includes(item.file.type)) {
        setStatusById((prev) => ({ ...prev, [item.id]: 'error' }));
        const typeError = t.admin.fileTypeError;
        setErrorById((prev) => ({ ...prev, [item.id]: typeError }));
        throw new Error(typeError);
      }

      const url = await uploadImageWithProgress(
        category,
        item,
        propertyKey,
        (value) => {
          setProgressById((prev) => ({ ...prev, [item.id]: value }));
        },
        (status, message) => {
          setStatusById((prev) => ({ ...prev, [item.id]: status }));
          if (message) setErrorById((prev) => ({ ...prev, [item.id]: message }));
        }
      );
      result.push(url);
    }
    return result;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const [facadeFront, facadeBack, facadeLeft, facadeRight, aerial] = await Promise.all([
        uploadBatch('gallery', facadeFrontImages),
        uploadBatch('gallery', facadeBackImages),
        uploadBatch('gallery', facadeLeftImages),
        uploadBatch('gallery', facadeRightImages),
        uploadBatch('aerial', aerialImages)
      ]);
      const gallery = [
        facadeFront[0] ?? '',
        facadeBack[0] ?? facadeFront[0] ?? '',
        facadeLeft[0] ?? facadeFront[0] ?? '',
        facadeRight[0] ?? facadeFront[0] ?? ''
      ].filter(Boolean);

      const response = await fetch(editing ? `/api/properties/${editing.slug}` : '/api/properties', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(gallery, aerial))
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t.admin.saveFailed);
      if (editing) onUpdated?.(data as Property);
      else onCreated(data as Property);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t.admin.unexpectedError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      <div className="space-y-1 border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-semibold text-slate-900">{editing ? t.admin.editProperty : t.admin.createProperty}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{t.admin.title}</span>
          <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.admin.title} className="w-full rounded-xl border px-3 py-2 text-right" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{t.admin.mapsUrl}</span>
          <input type="url" value={googleMapsUrl} onChange={(event) => setGoogleMapsUrl(event.target.value)} placeholder={t.admin.mapsUrl} className="w-full rounded-xl border px-3 py-2 text-right" />
          {parsedFromUrl && <p className="text-xs text-emerald-700">{t.admin.coordsParsed}: {parsedFromUrl.lat}, {parsedFromUrl.lng}</p>}
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Building area (m²)</span>
          <input type="number" min="1" step="0.1" value={buildingArea} onChange={(event) => setBuildingArea(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Building height (m)</span>
          <input type="number" min="1" step="0.1" value={buildingHeight} onChange={(event) => setBuildingHeight(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Floors</span>
          <input type="number" min="1" step="1" value={floorCount} onChange={(event) => setFloorCount(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Floor height (m)</span>
          <input type="number" min="0" step="0.1" value={floorHeight} onChange={(event) => setFloorHeight(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Rotation (deg)</span>
          <input type="number" step="0.1" value={rotation} onChange={(event) => setRotation(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Footprint width (m)</span>
          <input type="number" min="1" step="0.1" value={footprintWidth} onChange={(event) => setFootprintWidth(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">Footprint depth (m)</span>
          <input type="number" min="1" step="0.1" value={footprintDepth} onChange={(event) => setFootprintDepth(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span className="font-medium">Model URL (.glb/.gltf optional)</span>
          <input type="url" value={modelUrl} onChange={(event) => setModelUrl(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
      </div>


      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-medium">Building Appearance</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">Facade Mode
            <select value={facadeMode} onChange={(e)=>setFacadeMode(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="hybrid">hybrid</option><option value="image">image</option><option value="procedural">procedural</option></select>
          </label>
          <label className="text-sm">Roof Type
            <select value={roofType} onChange={(e)=>setRoofType(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="parapet">parapet</option><option value="flat">flat</option><option value="gable">gable</option></select>
          </label>
        </div>
      </details>

      
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-medium">Real Aerial Context</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">Scene mode<select value={sceneMode} onChange={(e)=>setSceneMode(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="procedural">procedural</option><option value="real_aerial">real_aerial</option><option value="real_aerial_with_osm">real_aerial_with_osm</option><option value="mixed">mixed</option></select></label>
          <label className="text-sm">Aerial image URL<input value={aerialImageUrl} onChange={(e)=>setAerialImageUrl(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">Aerial source<select value={aerialSource} onChange={(e)=>setAerialSource(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="other">other</option><option value="drone">drone</option><option value="licensed_orthophoto">licensed_orthophoto</option><option value="google_maps_screenshot">google_maps_screenshot</option><option value="osm">osm</option></select></label>
          <label className="text-sm">Attribution<input value={aerialAttribution} onChange={(e)=>setAerialAttribution(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">Aerial width meters<input value={aerialWidthMeters} onChange={(e)=>setAerialWidthMeters(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">Aerial depth meters<input value={aerialDepthMeters} onChange={(e)=>setAerialDepthMeters(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">Meters per pixel<input value={metersPerPixel} onChange={(e)=>setMetersPerPixel(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">Aerial rotation deg<input value={aerialRotationDeg} onChange={(e)=>setAerialRotationDeg(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm md:col-span-2"><input type="checkbox" checked={allowProceduralFallback} onChange={(e)=>setAllowProceduralFallback(e.target.checked)} className="mr-2"/>Allow procedural fallback</label>
          {aerialSource==='google_maps_screenshot' ? <p className="text-xs text-amber-700 md:col-span-2">Make sure you have the rights to use this imagery in the public property page and catalogue.</p> : null}
        </div>
      </details>

      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-medium">Site Context</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">Context Mode
            <select value={contextMode} onChange={(e)=>setContextMode(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="manual">manual</option><option value="hybrid">hybrid</option><option value="osm">osm</option></select>
          </label>
          <label className="text-sm">Environment Preset
            <select value={environmentPreset} onChange={(e)=>setEnvironmentPreset(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="urban_street">urban_street</option><option value="dense_urban">dense_urban</option><option value="suburban">suburban</option><option value="villa">villa</option><option value="commercial_strip">commercial_strip</option></select>
          </label>
        </div>
      </details>

      <label className="block space-y-1 text-sm text-slate-700">
        <span className="font-medium">{t.admin.description}</span>
        <textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t.admin.description} className="h-28 w-full rounded-xl border px-3 py-2 text-right" />
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        <ImageUploader
          label="Facade Front"
          helperText="Upload front facade image"
          value={facadeFrontImages}
          onChange={setFacadeFrontImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple={false}
        />
        <ImageUploader
          label="Facade Back"
          helperText="Upload back facade image"
          value={facadeBackImages}
          onChange={setFacadeBackImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple={false}
        />
        <ImageUploader
          label="Facade Left"
          helperText="Upload left facade image"
          value={facadeLeftImages}
          onChange={setFacadeLeftImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple={false}
        />
        <ImageUploader
          label="Facade Right"
          helperText="Upload right facade image"
          value={facadeRightImages}
          onChange={setFacadeRightImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple={false}
        />
        <ImageUploader
          label={t.admin.aerial}
          helperText={t.admin.uploadHintAerial}
          value={aerialImages}
          onChange={setAerialImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple={false}
        />
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={loading} className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-60">
          {loading ? t.admin.savingProperty : editing ? t.admin.updateProperty : t.admin.createProperty}
        </button>
        {editing && (
          <button type="button" onClick={onCancelEdit} className="rounded-xl border px-4 py-2">
            {t.common.cancel}
          </button>
        )}
      </div>
    </form>
  );
}

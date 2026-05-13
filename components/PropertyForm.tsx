'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ImageUploader, normalizeExistingImages, type UploadItem, type UploadStatus } from '@/components/admin/ImageUploader';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { parseGoogleMapsUrl } from '@/lib/maps';
import type { Property, PropertyPayload, PropertyViewerMode } from '@/types/property';

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
  const { t, locale } = useLanguage();
  const ui = locale === 'fa'
    ? { propertyNameHint: 'نام عمومی پروژه یا ملک در صفحه کیوآر نمایش داده می‌شود.', mapHint: 'پیوند نقشه یا مختصات خام را وارد کنید تا طول و عرض جغرافیایی خودکار تکمیل شود.', buildingArea: 'متراژ بنا (متر مربع)', buildingAreaHint: 'زیربنا یا برآورد سطح اشغال برای مقیاس سه‌بعدی.', buildingHeight: 'ارتفاع ساختمان (متر)', buildingHeightHint: 'ارتفاع کل ساختمان به متر.', floors: 'تعداد طبقات', floorsHint: 'تعداد طبقات برای مقیاس و خطوط راهنمای طبقات.', floorHeight: 'ارتفاع هر طبقه (متر)', floorHeightHint: 'میانگین ارتفاع هر طبقه.', rotation: 'چرخش (درجه)', rotationHint: 'چرخش دستی ساختمان در صحنه سه‌بعدی.', footprintWidth: 'عرض محدوده (متر)', footprintWidthHint: 'عرض واقعی ساختمان روی زمین.', footprintDepth: 'عمق محدوده (متر)', footprintDepthHint: 'عمق واقعی ساختمان روی زمین.', modelUrl: 'نشانی مدل سه‌بعدی (اختیاری)', modelUrlHint: 'فایل آماده با پسوند glb یا gltf.', viewerHeading: 'نمایشگر عمومی سه‌بعدی', viewerDesc: 'انتخاب کنید بازدیدکنندگان کیوآر ملک را با بافت شهری واقعی، مدل سه‌بعدی آماده یا ساختمان تولیدی ببینند.', viewerWarn: 'مختصات به‌تنهایی مدل دقیق ساختمان را نمی‌سازد؛ برای بیشترین دقت از مدل glb یا gltf استفاده کنید.', viewerMode: 'حالت نمایشگر', realWorld: 'دوقلوی واقعی مپ‌باکس', modelMode: 'مدل سه‌بعدی بارگذاری‌شده', generatedMode: 'ساختمان تولیدی جایگزین', viewerModeHint: 'حالت واقعی با توکن مپ‌باکس فعال می‌شود؛ حالت مدل از glb/gltf استفاده می‌کند؛ حالت تولیدی از ابعاد و تصاویر نما ساخته می‌شود.', lat: 'عرض جغرافیایی', lng: 'طول جغرافیایی', cameraAltitude: 'ارتفاع دوربین', cameraTilt: 'زاویه دوربین', cameraHeading: 'جهت دوربین', cameraRange: 'فاصله دوربین', facadeFront: 'نمای جلو', facadeBack: 'نمای پشت', facadeLeft: 'نمای چپ', facadeRight: 'نمای راست', facadeFrontHint: 'تصویر نمای جلو را بارگذاری کنید', facadeBackHint: 'تصویر نمای پشت را بارگذاری کنید', facadeLeftHint: 'تصویر نمای چپ را بارگذاری کنید', facadeRightHint: 'تصویر نمای راست را بارگذاری کنید', aerialImages: 'تصاویر هوایی', aerialHint: 'یک تصویر هوایی اصلی استفاده کنید؛ اگر کاشی ماهواره‌ای در دسترس نباشد، این تصویر به‌عنوان زمین جایگزین نمایش داده می‌شود.', positive: 'باید عددی مثبت باشد.', latError: 'عرض جغرافیایی باید بین منفی ۹۰ تا ۹۰ باشد.', lngError: 'طول جغرافیایی باید بین منفی ۱۸۰ تا ۱۸۰ باشد.', floorError: 'تعداد طبقات باید عدد صحیح مثبت باشد.', modelError: 'نشانی مدل باید به فایل glb یا gltf اشاره کند.' }
    : { propertyNameHint: 'Public project/property name shown on the QR landing page.', mapHint: 'Map link or raw coordinates for auto-filling latitude and longitude.', buildingArea: 'Building area (m²)', buildingAreaHint: 'Total building area or footprint estimate used for 3D sizing.', buildingHeight: 'Building height (m)', buildingHeightHint: 'Total height of the building in meters.', floors: 'Floors', floorsHint: 'Number of floors used for scale and floor guide lines.', floorHeight: 'Floor height (m)', floorHeightHint: 'Average height of each floor.', rotation: 'Rotation (deg)', rotationHint: 'Manual building rotation in the 3D scene.', footprintWidth: 'Footprint width (m)', footprintWidthHint: 'Real building width on the ground.', footprintDepth: 'Footprint depth (m)', footprintDepthHint: 'Real building depth on the ground.', modelUrl: 'Model URL (.glb/.gltf optional)', modelUrlHint: 'Optional ready-made 3D model file.', viewerHeading: '3D Public Viewer', viewerDesc: 'Choose how QR visitors see the property: real-world context, a supplied GLB/GLTF model, or a generated building from dimensions and facade images.', viewerWarn: 'Coordinates alone cannot generate an exact building model; use a custom GLB/GLTF for highest property-specific accuracy.', viewerMode: 'Viewer mode', realWorld: 'Mapbox real-world digital twin', modelMode: 'Standalone uploaded model', generatedMode: 'Generated building fallback', viewerModeHint: 'Real-world mode uses Mapbox when configured, model mode uses .glb/.gltf, generated fallback uses dimensions and facade images.', lat: 'Latitude', lng: 'Longitude', cameraAltitude: 'Camera altitude', cameraTilt: 'Camera tilt', cameraHeading: 'Camera heading', cameraRange: 'Camera range', facadeFront: 'Facade Front', facadeBack: 'Facade Back', facadeLeft: 'Facade Left', facadeRight: 'Facade Right', facadeFrontHint: 'Upload front facade image', facadeBackHint: 'Upload back facade image', facadeLeftHint: 'Upload left facade image', facadeRightHint: 'Upload right facade image', aerialImages: 'Aerial Images', aerialHint: 'Use one primary aerial image; if satellite tiles are unavailable, this becomes the ground fallback.', positive: 'must be a positive number.', latError: 'Latitude must be between -90 and 90.', lngError: 'Longitude must be between -180 and 180.', floorError: 'Floors must be a positive integer.', modelError: 'Model URL must point to a .glb or .gltf file.' };
  const [title, setTitle] = useState(editing?.title || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(editing?.googleMapsUrl || '');
  const [latitude, setLatitude] = useState(editing?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(editing?.longitude?.toString() || '');
  const [viewerMode, setViewerMode] = useState<PropertyViewerMode>(editing?.viewerMode || (editing?.modelUrl ? 'standalone_model' : 'parametric_fallback'));
  const [cameraAltitude, setCameraAltitude] = useState((editing?.cameraAltitude ?? 300).toString());
  const [cameraTilt, setCameraTilt] = useState((editing?.cameraTilt ?? 65).toString());
  const [cameraHeading, setCameraHeading] = useState((editing?.cameraHeading ?? 0).toString());
  const [cameraRange, setCameraRange] = useState((editing?.cameraRange ?? 300).toString());
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
  const [facadeMode, setFacadeMode] = useState(editing?.buildingAppearance?.facadeMode || (editing ? 'hybrid' : 'image'));
  const [roofType, setRoofType] = useState(editing?.buildingAppearance?.roofType || 'parapet');
  const [sceneMode, setSceneMode] = useState(editing?.viewerRealismMode?.sceneMode || (editing ? 'procedural' : 'real_aerial'));
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
    viewerRealismMode: { sceneMode, disableFakeSurroundings: true, disableProceduralFacadeDetailsWhenPhotosExist: true },
    latitude: parseOptionalNumber(latitude) ?? parsedFromUrl?.lat,
    longitude: parseOptionalNumber(longitude) ?? parsedFromUrl?.lng,
    viewerMode,
    cameraAltitude: parseOptionalNumber(cameraAltitude) ?? 300,
    cameraTilt: parseOptionalNumber(cameraTilt) ?? 65,
    cameraHeading: parseOptionalNumber(cameraHeading) ?? 0,
    cameraRange: parseOptionalNumber(cameraRange) ?? 300
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

  const validateForm = () => {
    const lat = parseOptionalNumber(latitude) ?? parsedFromUrl?.lat;
    const lng = parseOptionalNumber(longitude) ?? parsedFromUrl?.lng;
    if (lat !== undefined && (lat < -90 || lat > 90)) return ui.latError;
    if (lng !== undefined && (lng < -180 || lng > 180)) return ui.lngError;

    const positiveFields: Array<[string, string]> = [
      [buildingArea, ui.buildingArea],
      [buildingHeight, ui.buildingHeight],
      [floorHeight, ui.floorHeight],
      [footprintWidth, ui.footprintWidth],
      [footprintDepth, ui.footprintDepth],
      [cameraAltitude, '{ui.cameraAltitude}'],
      [cameraRange, '{ui.cameraRange}']
    ];
    for (const [value, label] of positiveFields) {
      const parsed = parseOptionalNumber(value);
      if (value.trim() && (parsed === undefined || parsed <= 0)) return `${label} ${ui.positive}`;
    }

    const floors = parseOptionalNumber(floorCount);
    if (floorCount.trim() && (!floors || floors < 1 || !Number.isInteger(floors))) return ui.floorError;
    const trimmedModelUrl = modelUrl.trim();
    if (trimmedModelUrl && !/\.(glb|gltf)(?:$|[?#])/i.test(trimmedModelUrl)) return ui.modelError;
    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

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
    <form className="property-form space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      <div className="space-y-1 border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-semibold text-slate-900">{editing ? t.admin.editProperty : t.admin.createProperty}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{t.admin.title}</span><span className="helper-text">{ui.propertyNameHint}</span>
          <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.admin.title} className="w-full rounded-xl border px-3 py-2 text-right" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{t.admin.mapsUrl}</span><span className="helper-text">{ui.mapHint}</span>
          <input type="text" value={googleMapsUrl} onChange={(event) => { const v = event.target.value; setGoogleMapsUrl(v); const parsed = parseGoogleMapsUrl(v); if (parsed) { setLatitude(String(parsed.lat)); setLongitude(String(parsed.lng)); } }} placeholder={t.admin.mapsUrl} className="w-full rounded-xl border px-3 py-2 text-right" />
          {parsedFromUrl && <p className="text-xs text-emerald-700">{t.admin.coordsParsed}: {parsedFromUrl.lat}, {parsedFromUrl.lng}</p>}
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{ui.buildingArea}</span><span className="helper-text">{ui.buildingAreaHint}</span>
          <input type="number" min="1" step="0.1" value={buildingArea} onChange={(event) => setBuildingArea(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{ui.buildingHeight}</span><span className="helper-text">{ui.buildingHeightHint}</span>
          <input type="number" min="1" step="0.1" value={buildingHeight} onChange={(event) => setBuildingHeight(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{ui.floors}</span><span className="helper-text">{ui.floorsHint}</span>
          <input type="number" min="1" step="1" value={floorCount} onChange={(event) => setFloorCount(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{ui.floorHeight}</span><span className="helper-text">{ui.floorHeightHint}</span>
          <input type="number" min="0" step="0.1" value={floorHeight} onChange={(event) => setFloorHeight(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{ui.rotation}</span><span className="helper-text">{ui.rotationHint}</span>
          <input type="number" step="0.1" value={rotation} onChange={(event) => setRotation(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>

        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{ui.footprintWidth}</span><span className="helper-text">{ui.footprintWidthHint}</span>
          <input type="number" min="1" step="0.1" value={footprintWidth} onChange={(event) => setFootprintWidth(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="font-medium">{ui.footprintDepth}</span><span className="helper-text">{ui.footprintDepthHint}</span>
          <input type="number" min="1" step="0.1" value={footprintDepth} onChange={(event) => setFootprintDepth(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
          <span className="font-medium">{ui.modelUrl}</span><span className="helper-text">{ui.modelUrlHint}</span>
          <input type="url" value={modelUrl} onChange={(event) => setModelUrl(event.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </label>
      </div>


      <section className="rounded-xl border border-slate-200 p-4">
        <h3 className="text-lg font-semibold text-slate-900">{ui.viewerHeading}</h3>
        <p className="mt-1 text-xs text-slate-600">{ui.viewerDesc}</p>
        <p className="mt-1 text-xs text-amber-700">{ui.viewerWarn}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm">{ui.viewerMode}<select value={viewerMode} onChange={(e)=>setViewerMode(e.target.value as PropertyViewerMode)} className="mt-1 w-full rounded border px-2 py-2"><option value="real_world_digital_twin">{ui.realWorld}</option><option value="standalone_model">{ui.modelMode}</option><option value="parametric_fallback">{ui.generatedMode}</option></select><span className="mt-1 block text-xs text-slate-500">{ui.viewerModeHint}</span></label>
          <label className="text-sm">{ui.lat}<input value={latitude} onChange={(e)=>setLatitude(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">{ui.lng}<input value={longitude} onChange={(e)=>setLongitude(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">{ui.cameraAltitude}<input value={cameraAltitude} onChange={(e)=>setCameraAltitude(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">{ui.cameraTilt}<input value={cameraTilt} onChange={(e)=>setCameraTilt(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">{ui.cameraHeading}<input value={cameraHeading} onChange={(e)=>setCameraHeading(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">{ui.cameraRange}<input value={cameraRange} onChange={(e)=>setCameraRange(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm md:col-span-2">Optional modelUrl<input type="url" value={modelUrl} onChange={(event) => setModelUrl(event.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
        </div>
      </section>

      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-medium">{locale === 'fa' ? 'ظاهر ساختمان' : 'Building Appearance'}</summary><p className="field-help mt-1">{locale === 'fa' ? 'نحوه نمایش نما و بام ساختمان را کنترل می‌کند.' : 'Controls how the building facade and roof are rendered.'}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">{locale === 'fa' ? 'حالت نما' : 'Facade Mode'}
            <select value={facadeMode} onChange={(e)=>setFacadeMode(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="hybrid">{locale === 'fa' ? 'ترکیبی' : 'hybrid'}</option><option value="image">{locale === 'fa' ? 'تصویر' : 'image'}</option><option value="procedural">{locale === 'fa' ? 'تولیدی' : 'procedural'}</option></select>
          </label>
          <label className="text-sm">{locale === 'fa' ? 'نوع بام' : 'Roof Type'}
            <select value={roofType} onChange={(e)=>setRoofType(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="parapet">{locale === 'fa' ? 'جان‌پناه' : 'parapet'}</option><option value="flat">{locale === 'fa' ? 'تخت' : 'flat'}</option><option value="gable">{locale === 'fa' ? 'شیروانی' : 'gable'}</option></select>
          </label>
        </div>
      </details>

      
      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-medium">{locale === 'fa' ? 'بافت هوایی واقعی' : 'Real Aerial Context'}</summary><p className="field-help mt-1">{locale === 'fa' ? 'از تصویر هوایی واقعی به‌عنوان زمین و محیط صفحه عمومی سه‌بعدی استفاده می‌شود.' : 'Use a real aerial image as the ground/environment for the public 3D page.'}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">{locale === 'fa' ? 'حالت صحنه' : 'Scene mode'}<select value={sceneMode} onChange={(e)=>setSceneMode(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="procedural">{locale === 'fa' ? 'تولیدی' : 'procedural'}</option><option value="real_aerial">{locale === 'fa' ? 'هوایی واقعی' : 'real_aerial'}</option><option value="real_aerial_with_osm">{locale === 'fa' ? 'هوایی واقعی با نقشه' : 'real_aerial_with_osm'}</option><option value="mixed">{locale === 'fa' ? 'ترکیبی' : 'mixed'}</option></select></label>
          <label className="text-sm">{locale === 'fa' ? 'نشانی تصویر هوایی' : 'Real aerial image URL'}<input value={aerialImageUrl} onChange={(e)=>setAerialImageUrl(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">{locale === 'fa' ? 'منبع تصویر هوایی' : 'Aerial source'}<select value={aerialSource} onChange={(e)=>setAerialSource(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="other">{locale === 'fa' ? 'سایر' : 'other'}</option><option value="drone">{locale === 'fa' ? 'پهپاد' : 'drone'}</option><option value="licensed_orthophoto">{locale === 'fa' ? 'ارتوفوتوی مجاز' : 'licensed_orthophoto'}</option><option value="google_maps_screenshot">{locale === 'fa' ? 'تصویر نقشه گوگل' : 'google_maps_screenshot'}</option><option value="osm">{locale === 'fa' ? 'نقشه باز' : 'osm'}</option></select></label>
          <label className="text-sm">{locale === 'fa' ? 'اعتبار منبع' : 'Attribution'}<input value={aerialAttribution} onChange={(e)=>setAerialAttribution(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">{locale === 'fa' ? 'عرض واقعی تصویر (متر)' : 'Real-world image width (m)'}<input value={aerialWidthMeters} onChange={(e)=>setAerialWidthMeters(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">{locale === 'fa' ? 'عمق واقعی تصویر (متر)' : 'Real-world image depth (m)'}<input value={aerialDepthMeters} onChange={(e)=>setAerialDepthMeters(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">{locale === 'fa' ? 'مقیاس: متر بر پیکسل' : 'Scale: meters per pixel'}<input value={metersPerPixel} onChange={(e)=>setMetersPerPixel(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm">{locale === 'fa' ? 'چرخش تصویر هوایی (درجه)' : 'Aerial image rotation (deg)'}<input value={aerialRotationDeg} onChange={(e)=>setAerialRotationDeg(e.target.value)} className="mt-1 w-full rounded border px-2 py-2"/></label>
          <label className="text-sm md:col-span-2"><input type="checkbox" checked={allowProceduralFallback} onChange={(e)=>setAllowProceduralFallback(e.target.checked)} className="mr-2"/>{locale === 'fa' ? 'اجازه جایگزین تولیدی' : 'Allow procedural fallback'}</label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 md:col-span-2">
            <p><b>{locale === 'fa' ? 'حالت صحنه' : 'Scene mode'}:</b> {sceneMode}</p>
            <p><b>{locale === 'fa' ? 'تصویر هوایی:' : 'Aerial image:'}</b> {aerialImageUrl ? (locale === 'fa' ? 'تنظیم شده' : 'configured') : (locale === 'fa' ? 'ثبت نشده' : 'missing')}</p>
            <p><b>{locale === 'fa' ? 'مقیاس:' : 'Scale:'}</b> {(aerialWidthMeters && aerialDepthMeters) || metersPerPixel ? (locale === 'fa' ? 'تنظیم شده' : 'configured') : (locale === 'fa' ? 'ثبت نشده' : 'missing')}</p>
            <p><b>{locale === 'fa' ? 'محدوده ساختمان:' : 'Building footprint:'}</b> {editing?.aerialContext?.buildingFootprintImagePoints ? (locale === 'fa' ? 'تنظیم شده' : 'configured') : (locale === 'fa' ? 'ثبت نشده' : 'missing')}</p>
            <p><b>{locale === 'fa' ? 'تصاویر نما:' : 'Facade photos:'}</b> {[facadeFrontImages[0],facadeBackImages[0],facadeLeftImages[0],facadeRightImages[0]].filter(Boolean).length}/4</p>
          </div>
          {aerialSource==='google_maps_screenshot' ? <p className="text-xs text-amber-700 md:col-span-2">{locale === 'fa' ? 'از مجوز استفاده از این تصویر در صفحه عمومی و کاتالوگ مطمئن شوید.' : 'Make sure you have the rights to use this imagery in the public property page and catalogue.'}</p> : null}
        </div>
      </details>

      <details className="rounded-xl border p-3">
        <summary className="cursor-pointer font-medium">{locale === 'fa' ? 'بافت سایت' : 'Site Context'}</summary><p className="field-help mt-1">{locale === 'fa' ? 'محیط پیرامونی تولیدی یا مبتنی بر نقشه را برای جایگزین یا بهبود کنترل می‌کند.' : 'Controls procedural or map-based surroundings used as fallback or enhancement.'}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">{locale === 'fa' ? 'حالت بافت' : 'Context Mode'}
            <select value={contextMode} onChange={(e)=>setContextMode(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="manual">{locale === 'fa' ? 'دستی' : 'manual'}</option><option value="hybrid">{locale === 'fa' ? 'ترکیبی' : 'hybrid'}</option><option value="osm">{locale === 'fa' ? 'نقشه باز' : 'osm'}</option></select>
          </label>
          <label className="text-sm">{locale === 'fa' ? 'پیش‌تنظیم محیط' : 'Environment Preset'}
            <select value={environmentPreset} onChange={(e)=>setEnvironmentPreset(e.target.value as any)} className="mt-1 w-full rounded border px-2 py-2"><option value="urban_street">{locale === 'fa' ? 'خیابان شهری' : 'urban_street'}</option><option value="dense_urban">{locale === 'fa' ? 'شهری متراکم' : 'dense_urban'}</option><option value="suburban">{locale === 'fa' ? 'حومه' : 'suburban'}</option><option value="villa">{locale === 'fa' ? 'ویلا' : 'villa'}</option><option value="commercial_strip">{locale === 'fa' ? 'تجاری خطی' : 'commercial_strip'}</option></select>
          </label>
        </div>
      </details>

      <label className="block space-y-1 text-sm text-slate-700">
        <span className="font-medium">{t.admin.description}</span>
        <textarea required value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t.admin.description} className="h-28 w-full rounded-xl border px-3 py-2 text-right" />
      </label>

      <div className="grid gap-4 xl:grid-cols-2">
        <ImageUploader
          label={ui.facadeFront}
          helperText={ui.facadeFrontHint}
          value={facadeFrontImages}
          onChange={setFacadeFrontImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple={false}
        />
        <ImageUploader
          label={ui.facadeBack}
          helperText={ui.facadeBackHint}
          value={facadeBackImages}
          onChange={setFacadeBackImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple={false}
        />
        <ImageUploader
          label={ui.facadeLeft}
          helperText={ui.facadeLeftHint}
          value={facadeLeftImages}
          onChange={setFacadeLeftImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple={false}
        />
        <ImageUploader
          label={ui.facadeRight}
          helperText={ui.facadeRightHint}
          value={facadeRightImages}
          onChange={setFacadeRightImages}
          progressById={progressById}
          statusById={statusById}
          errorById={errorById}
          onUrlValidationError={setError}
          multiple={false}
        />
        <ImageUploader
          label={ui.aerialImages}
          helperText={ui.aerialHint}
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

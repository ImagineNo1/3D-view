import type { BuildingModelData } from './generators';

type ViewKey = 'top' | 'front' | 'left';

export type ProjectionCanvases = Record<ViewKey, HTMLCanvasElement>;

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadImage(url: string | null) {
  if (!url) return Promise.resolve<HTMLImageElement | null>(null);

  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function drawView(options: {
  canvas: HTMLCanvasElement;
  image: HTMLImageElement | null;
  label: string;
  outlineWidth: number;
  outlineHeight: number;
  lat: number;
  lon: number;
}) {
  const { canvas, image, label, outlineWidth, outlineHeight, lat, lon } = options;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const margin = 36;
  const frameWidth = canvas.width - margin * 2;
  const frameHeight = canvas.height - margin * 2 - 28;
  const scale = Math.min(frameWidth / outlineWidth, frameHeight / outlineHeight);
  const drawWidth = outlineWidth * scale;
  const drawHeight = outlineHeight * scale;
  const x = (canvas.width - drawWidth) / 2;
  const y = (canvas.height - drawHeight) / 2 + 6;

  if (image) {
    ctx.drawImage(image, x, y, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(x, y, drawWidth, drawHeight);
  }

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, drawWidth, drawHeight);

  ctx.fillStyle = '#0f172a';
  ctx.font = '600 20px Inter, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, 20, 30);

  ctx.font = '500 13px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#334155';
  ctx.fillText(`Lat ${lat.toFixed(6)} | Lon ${lon.toFixed(6)}`, canvas.width - 20, canvas.height - 12);
}

export async function generateOrthographicCanvases(model: BuildingModelData): Promise<ProjectionCanvases> {
  const [topImage, frontImage, leftImage] = await Promise.all([
    loadImage(model.assets.aerialImage),
    loadImage(model.assets.facadeFront),
    loadImage(model.assets.facadeLeft)
  ]);

  const top = createCanvas(900, 500);
  const front = createCanvas(900, 500);
  const left = createCanvas(900, 500);

  drawView({
    canvas: top,
    image: topImage,
    label: 'Orthographic Top View',
    outlineWidth: model.width,
    outlineHeight: model.depth,
    lat: model.lat,
    lon: model.lon
  });

  drawView({
    canvas: front,
    image: frontImage,
    label: 'Orthographic Front View',
    outlineWidth: model.width,
    outlineHeight: model.buildingHeight,
    lat: model.lat,
    lon: model.lon
  });

  drawView({
    canvas: left,
    image: leftImage,
    label: 'Orthographic Left View',
    outlineWidth: model.depth,
    outlineHeight: model.buildingHeight,
    lat: model.lat,
    lon: model.lon
  });

  return { top, front, left };
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
}

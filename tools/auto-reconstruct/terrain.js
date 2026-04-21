function cubicWeight(t) {
  const a = -0.5;
  const u = Math.abs(t);
  if (u <= 1) return (a + 2) * u ** 3 - (a + 3) * u ** 2 + 1;
  if (u < 2) return a * u ** 3 - 5 * a * u ** 2 + 8 * a * u - 4 * a;
  return 0;
}

function sampleBicubic(src, sw, sh, x, y) {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  let v = 0;
  let sum = 0;

  for (let j = -1; j <= 2; j += 1) {
    for (let i = -1; i <= 2; i += 1) {
      const sx = Math.min(sw - 1, Math.max(0, fx + i));
      const sy = Math.min(sh - 1, Math.max(0, fy + j));
      const w = cubicWeight(i - (x - fx)) * cubicWeight(j - (y - fy));
      v += src[sy * sw + sx] * w;
      sum += w;
    }
  }

  return v / Math.max(sum, 1e-6);
}

function hash2(x, y) {
  const s = Math.sin((x * 127.1 + y * 311.7) * 43758.5453123);
  return s - Math.floor(s);
}

function noise2(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const lerpX1 = a + (b - a) * ux;
  const lerpX2 = c + (d - c) * ux;
  return lerpX1 + (lerpX2 - lerpX1) * uy;
}

function fractalNoise(x, y, octaves = 5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise2(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / Math.max(norm, 1e-6);
}

function generateTerrain({ buffer, width, height, pixelSizeMeters }) {
  const outW = 1024;
  const outH = 1024;

  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      gray[y * width + x] = (buffer[i] + buffer[i + 1] + buffer[i + 2]) / (3 * 255);
    }
  }

  const upscaled = new Float32Array(outW * outH);
  for (let y = 0; y < outH; y += 1) {
    const sy = (y / (outH - 1)) * (height - 1);
    for (let x = 0; x < outW; x += 1) {
      const sx = (x / (outW - 1)) * (width - 1);
      upscaled[y * outW + x] = sampleBicubic(gray, width, height, sx, sy);
    }
  }

  const terrain = new Float32Array(outW * outH);
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const i = y * outW + x;
      const nx = x / outW;
      const ny = y / outH;

      const base = upscaled[i];
      const perlin = fractalNoise(nx * 8, ny * 8, 5);
      const ridge = 1 - Math.abs(2 * fractalNoise(nx * 13, ny * 13, 4) - 1);
      const micro = fractalNoise(nx * 30, ny * 30, 3);
      const mixed = base * 0.72 + perlin * 0.18 + ridge * 0.08 + micro * 0.02;

      const cx = Math.abs(nx * 2 - 1);
      const cy = Math.abs(ny * 2 - 1);
      const d = Math.min(1, Math.sqrt(cx * cx + cy * cy));
      const fade = d > 0.82 ? 1 - ((d - 0.82) / 0.18) ** 2 : 1;
      const h = Math.max(0, mixed * Math.max(0, fade));

      terrain[i] = h;
      if (h < min) min = h;
      if (h > max) max = h;
    }
  }

  const span = Math.max(1e-6, max - min);
  for (let i = 0; i < terrain.length; i += 1) {
    terrain[i] = ((terrain[i] - min) / span) * 12;
  }

  return {
    heightmap: terrain,
    width: outW,
    height: outH,
    scaleMeters: pixelSizeMeters,
    generated: true
  };
}

module.exports = { generateTerrain };

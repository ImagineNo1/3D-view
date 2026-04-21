function generateTerrain({ buffer, width, height, pixelSizeMeters }) {
  const outW = 256;
  const outH = 256;
  const hmap = new Float32Array(outW * outH);

  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const sx = Math.floor((x / outW) * width);
      const sy = Math.floor((y / outH) * height);
      const i = (sy * width + sx) * 4;
      const v = (buffer[i] + buffer[i + 1] + buffer[i + 2]) / (3 * 255);
      hmap[y * outW + x] = v;
    }
  }

  const smooth = new Float32Array(hmap.length);
  for (let y = 1; y < outH - 1; y += 1) {
    for (let x = 1; x < outW - 1; x += 1) {
      let s = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          s += hmap[(y + oy) * outW + (x + ox)];
        }
      }
      smooth[y * outW + x] = s / 9;
    }
  }

  let min = Infinity; let max = -Infinity;
  for (let i = 0; i < smooth.length; i += 1) {
    if (smooth[i] < min) min = smooth[i];
    if (smooth[i] > max) max = smooth[i];
  }
  const denom = Math.max(1e-6, max - min);
  for (let i = 0; i < smooth.length; i += 1) {
    smooth[i] = ((smooth[i] - min) / denom) * 15;
  }

  return {
    heightmap: smooth,
    width: outW,
    height: outH,
    scaleMeters: pixelSizeMeters,
    generated: true
  };
}

module.exports = { generateTerrain };

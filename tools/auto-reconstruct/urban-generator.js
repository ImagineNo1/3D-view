function intersects(a, b) {
  const ab = bounds(a.footprint);
  const bb = bounds(b.footprint);
  return !(ab.maxX < bb.minX || ab.minX > bb.maxX || ab.maxY < bb.minY || ab.minY > bb.maxY);
}

function bounds(poly) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

function makeBuilding(x, y, w, h, type) {
  let height = 10;
  if (type === 'commercial') height = 20 + Math.random() * 40;
  if (type === 'tower') height = 80 + Math.random() * 100;
  if (type === 'residential') height = 6 + Math.random() * 9;
  return {
    footprint: [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]],
    height,
    type
  };
}

function addSyntheticBuildings(existing, width, height, pixelSizeMeters) {
  const buildings = [...existing];
  if (buildings.length >= 30) return { buildings, added: 0 };

  const target = Math.max(80, Math.min(150, 80 + Math.floor(Math.random() * 40)));
  const streetPx = Math.max(14, Math.round(12 / pixelSizeMeters));
  const blockMinPx = Math.max(20, Math.round(60 / pixelSizeMeters));
  const blockMaxPx = Math.max(blockMinPx + 10, Math.round(120 / pixelSizeMeters));

  for (let y = streetPx; y < height - streetPx && buildings.length < target; ) {
    const blockH = blockMinPx + Math.floor(Math.random() * (blockMaxPx - blockMinPx));
    for (let x = streetPx; x < width - streetPx && buildings.length < target; ) {
      const blockW = blockMinPx + Math.floor(Math.random() * (blockMaxPx - blockMinPx));
      const slots = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < slots && buildings.length < target; i += 1) {
        const bw = Math.max(10, Math.floor(blockW * (0.25 + Math.random() * 0.35)));
        const bh = Math.max(10, Math.floor(blockH * (0.25 + Math.random() * 0.35)));
        const bx = x + 3 + Math.floor(Math.random() * Math.max(1, blockW - bw - 6));
        const by = y + 3 + Math.floor(Math.random() * Math.max(1, blockH - bh - 6));
        const r = Math.random();
        const type = r > 0.9 ? 'tower' : (r > 0.55 ? 'commercial' : 'residential');
        const b = makeBuilding(bx, by, bw, bh, type);
        if (!buildings.some((e) => intersects(e, b))) buildings.push(b);
      }
      x += blockW + streetPx;
    }
    y += blockH + streetPx;
  }

  const signatureCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < signatureCount; i += 1) {
    const bw = 20 + Math.random() * 18;
    const bh = 20 + Math.random() * 18;
    const bx = 30 + Math.random() * (width - bw - 60);
    const by = 30 + Math.random() * (height - bh - 60);
    const tower = makeBuilding(bx, by, bw, bh, 'tower');
    if (!buildings.some((e) => intersects(e, tower))) buildings.push(tower);
  }

  return { buildings: buildings.slice(0, 150), added: Math.max(0, buildings.length - existing.length) };
}

module.exports = { addSyntheticBuildings };

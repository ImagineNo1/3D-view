function transformToWorld({ buildings, terrain, width, height, pixelSizeMeters }) {
  const cx = width / 2;
  const cy = height / 2;
  const worldBuildings = buildings.map((b) => ({
    footprint: b.footprint.map(([px, py]) => [
      (px - cx) * pixelSizeMeters,
      (py - cy) * pixelSizeMeters
    ]),
    height: b.height,
    type: b.type
  }));

  return {
    buildings: worldBuildings,
    terrain
  };
}

module.exports = { transformToWorld };

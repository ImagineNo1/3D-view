import * as THREE from 'https://unpkg.com/three@0.180.0/build/three.module.js';

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function textureFromCanvas(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createWallTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#7f8792';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 6; y < 256; y += 18) {
    for (let x = 6; x < 256; x += 14) {
      const lit = Math.random() > 0.55;
      ctx.fillStyle = lit ? 'rgba(250,240,180,0.85)' : 'rgba(80,95,120,0.85)';
      ctx.fillRect(x, y, 8, 10);
    }
  }
  return textureFromCanvas(c);
}

export function createRoofTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#555b62';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = `rgba(${90 + Math.random() * 40},${90 + Math.random() * 40},${90 + Math.random() * 40},0.5)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 30, 6 + Math.random() * 20);
  }
  return textureFromCanvas(c);
}

export function createRoadTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4f5258';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#d8d05a';
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.moveTo(0, 128);
  ctx.lineTo(256, 128);
  ctx.stroke();
  return textureFromCanvas(c);
}

export function createGrassTexture() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4f7c43';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i += 1) {
    ctx.fillStyle = `rgba(${50 + Math.random() * 60},${90 + Math.random() * 100},${40 + Math.random() * 40},0.35)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  return textureFromCanvas(c);
}

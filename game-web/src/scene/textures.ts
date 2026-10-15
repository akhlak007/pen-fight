import * as THREE from 'three';

function textureFromCanvas(canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return texture;
}

export function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas textures are unavailable.');
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0, '#6f2f0e');
  gradient.addColorStop(0.25, '#a95016');
  gradient.addColorStop(0.5, '#7f370f');
  gradient.addColorStop(0.75, '#b35d1c');
  gradient.addColorStop(1, '#6a2b0d');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 417;
  for (let index = 0; index < 110; index += 1) {
    seed = (seed * 16807) % 2147483647;
    const y = (seed / 2147483647) * canvas.height;
    context.strokeStyle = `rgba(49, 19, 5, ${0.04 + (index % 5) * 0.012})`;
    context.lineWidth = 0.5 + (index % 3) * 0.35;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(130, y + Math.sin(index) * 10, 330, y - Math.cos(index) * 8, 512, y + 3);
    context.stroke();
  }
  return textureFromCanvas(canvas, 1.7, 1.2);
}

export function createTileTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas textures are unavailable.');
  context.fillStyle = '#c7bea0';
  context.fillRect(0, 0, 256, 256);
  context.strokeStyle = '#655e49';
  context.lineWidth = 5;
  for (let n = 0; n <= 256; n += 64) {
    context.beginPath(); context.moveTo(n, 0); context.lineTo(n, 256); context.stroke();
    context.beginPath(); context.moveTo(0, n); context.lineTo(256, n); context.stroke();
  }
  for (let index = 0; index < 420; index += 1) {
    const x = (index * 83) % 256;
    const y = (index * 137) % 256;
    context.fillStyle = `rgba(60, 52, 36, ${0.025 + (index % 4) * 0.01})`;
    context.fillRect(x, y, 1.5, 1.5);
  }
  return textureFromCanvas(canvas, 7, 6);
}

export function createBlackboardTexture(playerName: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 460;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas textures are unavailable.');
  const gradient = context.createRadialGradient(520, 220, 20, 520, 220, 620);
  gradient.addColorStop(0, '#183b2d');
  gradient.addColorStop(1, '#071a14');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 0.08;
  for (let index = 0; index < 140; index += 1) {
    context.fillStyle = '#dce6c8';
    context.fillRect((index * 97) % 1024, (index * 53) % 460, 30 + (index % 70), 1);
  }
  context.globalAlpha = 1;
  context.fillStyle = '#e6e2bf';
  context.textAlign = 'center';
  context.font = '700 72px "Comic Sans MS", cursive';
  context.fillText('PEN FIGHT', 512, 120);
  context.font = '32px "Comic Sans MS", cursive';
  context.fillText('Practice makes a champion', 512, 176);
  context.textAlign = 'left';
  context.font = '36px "Comic Sans MS", cursive';
  context.fillText(`${playerName || 'New challenger'}   0`, 120, 282);
  context.fillText('Class rival        0', 120, 346);
  context.strokeStyle = '#e6e2bf';
  context.lineWidth = 4;
  context.strokeRect(690, 240, 46, 46);
  context.strokeRect(755, 240, 46, 46);
  context.strokeRect(820, 240, 46, 46);
  return textureFromCanvas(canvas);
}

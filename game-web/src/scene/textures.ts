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
  gradient.addColorStop(0, '#68401d');
  gradient.addColorStop(0.25, '#a56628');
  gradient.addColorStop(0.5, '#7d4a1e');
  gradient.addColorStop(0.75, '#b5742f');
  gradient.addColorStop(1, '#633917');
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
  context.lineCap = 'round';
  for (let index = 0; index < 34; index += 1) {
    const x = 24 + ((index * 137) % 460);
    const y = 18 + ((index * 71) % 215);
    const length = 16 + (index % 5) * 12;
    context.strokeStyle = `rgba(255, 220, 156, ${0.12 + (index % 4) * 0.035})`;
    context.lineWidth = 0.8 + (index % 2) * 0.7;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + length, y + ((index % 3) - 1) * 9);
    context.stroke();
  }
  context.font = '22px cursive';
  context.strokeStyle = 'rgba(76, 37, 10, .22)';
  context.lineWidth = 1.5;
  context.strokeText('R + M', 328, 88);
  context.strokeText('#', 78, 194);
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
  context.font = '700 54px "Comic Sans MS", cursive';
  context.fillText('Thought for the Day :', 512, 72);
  context.font = '30px "Comic Sans MS", cursive';
  context.fillText('Practice makes a champion', 512, 116);
  context.textAlign = 'left';
  context.font = '700 39px "Comic Sans MS", cursive';
  context.fillText('PEN FIGHT', 105, 205);
  context.beginPath(); context.moveTo(100, 218); context.lineTo(405, 218); context.stroke();
  context.font = '34px "Comic Sans MS", cursive';
  context.fillText(`${playerName || 'New challenger'}     0`, 105, 285);
  context.fillText('Class rival          0', 105, 350);
  context.font = '24px "Comic Sans MS", cursive';
  context.fillText('Std. 9 - A', 42, 45);
  context.fillText('Sub : Maths', 42, 78);
  context.fillText('Date : 15 / 10', 805, 43);
  context.fillText('H.W.', 760, 130);
  context.fillText('Ch. 4 Q. 1 - 5', 760, 168);
  context.fillText('Map of India', 760, 206);
  context.fillText('Remember: Aim', 760, 372);
  context.strokeStyle = '#e6e2bf';
  context.lineWidth = 4;
  for (let x = 0; x < 5; x += 1) context.strokeRect(420 + x * 56, 270, 38, 38);
  return textureFromCanvas(canvas);
}

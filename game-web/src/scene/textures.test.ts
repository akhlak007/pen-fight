import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlackboardTexture } from './textures';

function installCanvasMock() {
  const fillText = vi.fn();
  const gradient = { addColorStop: vi.fn() };
  const context = {
    beginPath: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    fillText,
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    getContext: vi.fn(() => context),
    height: 0,
    width: 0,
  } as unknown as HTMLCanvasElement;
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
  return fillText;
}

describe('createBlackboardTexture', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('writes the opponent name and Bangladesh homework onto the board', () => {
    const fillText = installCanvasMock();

    const texture = createBlackboardTexture('Arpon', 'Priya', [1, 2]);

    expect(fillText).toHaveBeenCalledWith('Priya', 105, 350, 220);
    expect(fillText).toHaveBeenCalledWith('2', 380, 350);
    expect(fillText).toHaveBeenCalledWith('Map of Bangladesh', 760, 206);
    texture.dispose();
  });

  it('uses the AI rival fallback when no opponent is supplied', () => {
    const fillText = installCanvasMock();

    const texture = createBlackboardTexture('Arpon');

    expect(fillText).toHaveBeenCalledWith('AI rival', 105, 350, 220);
    texture.dispose();
  });
});

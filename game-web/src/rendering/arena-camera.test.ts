import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { framePhoneArena } from './arena-camera';

describe('phone arena camera', () => {
  it.each([
    [320, 568],
    [360, 800],
    [390, 844],
    [430, 932],
  ])('keeps the complete desk inside a %sx%s portrait viewport', (width, height) => {
    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 100);
    const bounds = framePhoneArena(camera, width, height);

    expect(bounds.left).toBeGreaterThanOrEqual(9.5);
    expect(bounds.right).toBeLessThanOrEqual(width - 9.5);
    expect(bounds.top).toBeGreaterThanOrEqual(55.5);
    expect(bounds.bottom).toBeLessThanOrEqual(height - 87.5);
  });

  it('mirrors the full-table framing for player two', () => {
    const camera = new THREE.PerspectiveCamera(58, 390 / 844, 0.1, 100);
    const bounds = framePhoneArena(camera, 390, 844, true);

    expect(bounds.left).toBeGreaterThanOrEqual(9.5);
    expect(bounds.right).toBeLessThanOrEqual(380.5);
    expect(bounds.bottom).toBeLessThanOrEqual(756.5);
  });
});

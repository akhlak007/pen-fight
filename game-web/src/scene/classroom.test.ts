import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./textures', () => ({
  createBlackboardTexture: () => new THREE.Texture(),
  createTileTexture: () => new THREE.Texture(),
  createWoodTexture: () => new THREE.Texture(),
}));

import { createClassroom } from './classroom';

describe('classroom aiming preview', () => {
  let scene: ReturnType<typeof createClassroom>;
  let playerPen: THREE.Object3D;

  beforeEach(() => {
    scene = createClassroom();
    const candidate = scene.heroPens.children[0];
    if (!candidate) throw new Error('Player pen was not created.');
    playerPen = candidate;
  });

  it('keeps the player pen position and rotation fixed while targeting', () => {
    const position = playerPen.position.clone();
    const quaternion = playerPen.quaternion.clone();

    expect(scene.aim(1.4, 0.9)).toBe(true);

    expect(playerPen.position.equals(position)).toBe(true);
    expect(playerPen.quaternion.equals(quaternion)).toBe(true);
  });

  it('clears residual motion before a new targeting preview begins', () => {
    scene.setMatchMode('practice');
    expect(scene.aim(-0.16, 0.16)).toBe(true);
    expect(scene.flick()).toBe(true);

    let targetingStarted = false;
    let time = 0;
    for (let frame = 0; frame < 600; frame += 1) {
      time += 1000 / 60;
      scene.update(time, 1 / 60, true);
      if (scene.aim(-0.16, 0.16)) {
        targetingStarted = true;
        break;
      }
    }
    expect(targetingStarted).toBe(true);

    const position = playerPen.position.clone();
    const quaternion = playerPen.quaternion.clone();
    scene.update(time + 1000 / 60, 1 / 60, true);

    expect(playerPen.position.equals(position)).toBe(true);
    expect(playerPen.quaternion.equals(quaternion)).toBe(true);
  });

  it('hands local control to the red pen after the blue shot settles', () => {
    const redPen = scene.heroPens.children[1];
    if (!redPen) throw new Error('Second player pen was not created.');
    scene.setMatchMode('local');
    scene.aim(-0.16, 0.16);
    scene.flick();

    let secondTurnReady = false;
    let time = 0;
    for (let frame = 0; frame < 600; frame += 1) {
      time += 1000 / 60;
      scene.update(time, 1 / 60, true);
      if (scene.aim(0.16, -0.16)) {
        secondTurnReady = true;
        break;
      }
    }
    expect(secondTurnReady).toBe(true);

    const bluePosition = playerPen.position.clone();
    const redPosition = redPen.position.clone();
    const redQuaternion = redPen.quaternion.clone();
    scene.aim(0.4, -0.4);
    expect(redPen.position.equals(redPosition)).toBe(true);
    expect(redPen.quaternion.equals(redQuaternion)).toBe(true);

    expect(scene.flick()).toBe(true);
    scene.update(time + 1000 / 60, 1 / 60, true);

    expect(playerPen.position.equals(bluePosition)).toBe(true);
    expect(redPen.position.equals(redPosition)).toBe(false);
  });

  it('never emits AI actions during a local match', () => {
    const actions: string[] = [];
    scene.setActionListener((action) => actions.push(action));
    scene.setMatchMode('local');
    scene.aim(-0.16, 0.16);
    scene.flick();

    let time = 0;
    for (let frame = 0; frame < 600; frame += 1) {
      time += 1000 / 60;
      scene.update(time, 1 / 60, true);
      if (scene.aim(0.16, -0.16)) {
        scene.flick();
        break;
      }
    }
    for (let frame = 0; frame < 600; frame += 1) {
      time += 1000 / 60;
      scene.update(time, 1 / 60, true);
      if (scene.aim(-0.16, 0.16)) break;
    }

    expect(actions).not.toContain('aiWaiting');
    expect(actions).not.toContain('aiMoving');
    expect(actions).toContain('playerMoving');
    expect(actions).toContain('ready');
  });
});

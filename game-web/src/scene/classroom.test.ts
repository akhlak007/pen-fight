import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./textures', () => ({
  createBlackboardTexture: () => new THREE.Texture(),
  createTileTexture: () => new THREE.Texture(),
  createWoodTexture: () => new THREE.Texture(),
}));

import { createClassroom } from './classroom';
import { type DeskWorld, startDeskWorld } from '../game/desk-physics';
import { challengeForLevel } from '../game/arena-challenges';

describe('classroom aiming preview', () => {
  let scene: ReturnType<typeof createClassroom>;
  let playerPen: THREE.Object3D;

  beforeEach(async () => {
    scene = createClassroom();
    await scene.ready;
    const candidate = scene.heroPens.children[0];
    if (!candidate) throw new Error('Player pen was not created.');
    playerPen = candidate;
  });

  it('spins a tip grab and leaves a center grab straight', async () => {
    scene.setMatchMode('practice');
    expect(scene.aim(0, 1.2, 1)).toBe(true);
    expect(scene.flick()).toBe(true);
    const spun = playerPen.rotation.y;
    scene.update(0, 0.05, true);
    expect(playerPen.rotation.y).not.toBeCloseTo(spun, 3);

    scene.setMatchMode('practice');
    const settled = playerPen.rotation.y;
    expect(scene.aim(0, 1.2, 0)).toBe(true);
    expect(scene.flick()).toBe(true);
    scene.update(0, 0.05, true);
    expect(playerPen.rotation.y).toBeCloseTo(settled, 2);
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

  it('renders a locked Quick Match challenge and restores the standard desk for practice', () => {
    const challenge = challengeForLevel(24);
    scene.setMatchMode('quick', 2, undefined, challenge);
    const obstacleId = challenge.obstacles[0]?.id;
    expect(obstacleId).toBeDefined();
    expect(scene.group.getObjectByName(`arena-obstacle:${obstacleId}`)).toBeDefined();

    scene.resetPens();
    expect(scene.group.getObjectByName(`arena-obstacle:${obstacleId}`)).toBeDefined();
    scene.setMatchMode('practice');
    expect(scene.group.getObjectByName(`arena-obstacle:${obstacleId}`)).toBeUndefined();
    const standardTop = scene.group.getObjectByName('arena-table-top') as THREE.Mesh<THREE.BufferGeometry>;
    standardTop.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    standardTop.geometry.boundingBox?.getSize(size);
    expect(size.x).toBeCloseTo(11.8, 2);
    expect(size.z).toBeCloseTo(14.8, 2);
    const leftZone = scene.group.getObjectByName('arena-start-zone:0');
    const rightZone = scene.group.getObjectByName('arena-start-zone:1');
    expect(leftZone?.position.x).toBeCloseTo(-4.6, 3);
    expect(leftZone?.position.z).toBeCloseTo(6, 3);
    expect(rightZone?.position.x).toBeCloseTo(4.6, 3);
    expect(rightZone?.position.z).toBeCloseTo(-6, 3);
  });

  it('renders both visible chalk gates for level 4', () => {
    const challenge = challengeForLevel(4);
    scene.setMatchMode('quick', 2, undefined, challenge);

    expect(challenge.name).toBe('Chalk Gate');
    expect(scene.group.getObjectByName('arena-obstacle:training-gate-left-4')).toBeDefined();
    expect(scene.group.getObjectByName('arena-obstacle:training-gate-right-4')).toBeDefined();
  });

  it('renders distinct permanent tabletop themes and number badges across representative levels', () => {
    const representativeLevels = [1, 5, 6, 50, 99];
    const renderedColors = new Set<string>();
    for (const level of representativeLevels) {
      const challenge = challengeForLevel(level);
      scene.setMatchMode('quick', 2, undefined, challenge);
      const badge = scene.group.getObjectByName('arena-level-badge');
      const tint = scene.group.getObjectByName('arena-level-tint') as THREE.Mesh | undefined;
      expect(badge?.userData.level).toBe(level);
      expect(badge?.userData.theme).toBe(challenge.visual.key);
      expect(tint).toBeDefined();
      const material = tint?.material as THREE.MeshBasicMaterial | undefined;
      if (material) renderedColors.add(material.color.getHexString());
    }
    expect(renderedColors.size).toBe(representativeLevels.length);

    scene.setMatchMode('practice');
    expect(scene.group.getObjectByName('arena-level-badge')).toBeUndefined();
    expect(scene.group.getObjectByName('arena-level-tint')).toBeUndefined();
  });

  it('keeps patrolling chalk moving while the player is aiming without moving the pens', () => {
    const challenge = challengeForLevel(7);
    const chalk = challenge.obstacles[0];
    if (!chalk) throw new Error('Level 7 chalk was not configured.');
    scene.setMatchMode('quick', 2, undefined, challenge);
    const mesh = scene.group.getObjectByName(`arena-obstacle:${chalk.id}`);
    if (!mesh) throw new Error('Level 7 chalk mesh was not rendered.');
    const chalkStart = mesh.position.clone();
    const penStarts = scene.heroPens.children.slice(0, 2).map((pen) => pen.position.clone());

    for (let frame = 0; frame < 120; frame += 1) scene.update(frame * (1000 / 60), 1 / 60, true);

    expect(mesh.position.distanceTo(chalkStart)).toBeGreaterThan(0.05);
    scene.heroPens.children.slice(0, 2).forEach((pen, index) => {
      expect(pen.position.distanceTo(penStarts[index]!)).toBeLessThan(1e-6);
    });
  });

  it('freezes both pens before the chalk keeps patrolling during the AI delay', async () => {
    const world = await startDeskWorld();
    const sleepPens = vi.spyOn(world, 'sleepPens');
    scene = createClassroom(() => Promise.resolve(world));
    await scene.ready;
    scene.setMatchMode('quick', 2, undefined, challengeForLevel(7));
    const sleepsBeforeShot = sleepPens.mock.calls.length;
    const actions: string[] = [];
    scene.setActionListener((action) => actions.push(action));
    scene.aim(0, 1.2);
    scene.flick();

    for (let frame = 0; frame < 900 && !actions.includes('aiWaiting'); frame += 1) {
      scene.update(frame * (1000 / 60), 1 / 60, true);
    }

    expect(actions).toContain('aiWaiting');
    expect(sleepPens.mock.calls.length).toBeGreaterThan(sleepsBeforeShot);
  });

  it('defers a late Rapier handoff until the fallback shot finishes', async () => {
    const world = await startDeskWorld();
    let resolveWorld!: (value: DeskWorld) => void;
    const delayedWorld = new Promise<DeskWorld>((resolve) => { resolveWorld = resolve; });
    scene = createClassroom(() => delayedWorld);
    const pen = scene.heroPens.children[0];
    if (!pen) throw new Error('Player pen was not created.');

    scene.setMatchMode('practice');
    scene.aim(0, 1.2);
    scene.flick();
    scene.update(0, 0.05, true);
    const beforeHandoff = pen.position.clone();

    resolveWorld(world);
    await scene.ready;
    scene.update(50, 0.05, true);

    expect(Math.hypot(
      pen.position.x - beforeHandoff.x,
      pen.position.z - beforeHandoff.z,
    )).toBeGreaterThan(0.01);
  });

  it('does not start an automatic fall while waiting for a shot', async () => {
    const world = await startDeskWorld();
    vi.spyOn(world, 'isOut').mockReturnValue(true);
    scene = createClassroom(() => Promise.resolve(world));
    await scene.ready;
    scene.setMatchMode('practice');
    const actions: string[] = [];
    scene.setActionListener((action) => actions.push(action));

    scene.update(0, 1 / 60, true);

    expect(actions).not.toContain('roundReset');
    expect(scene.getArenaSnapshot(1, [0, 0]).phase).toBe('player');
  });
});

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../scene/textures', () => ({
  createBlackboardTexture: () => new THREE.Texture(),
  createTileTexture: () => new THREE.Texture(),
  createWoodTexture: () => new THREE.Texture(),
}));

import { createClassroom } from '../scene/classroom';
import { axialShotEfficiency } from './pen-rules';
import { STANDARD_ARENA, challengeForLevel } from './arena-challenges';
import {
  DESK_STEP,
  DESK_TOP,
  impulseMagnitude,
  powerForImpulse,
  interiorRecoveryPosition,
  PEN_HALF_LENGTH,
  isSafelyInsideDesk,
  PEN_RADIUS,
  physicsQuaternionFromRender,
  penMotionSpeed,
  renderQuaternionFromPhysics,
  startDeskWorld,
  strikeDistance,
  shouldRecoverInteriorPen,
} from './desk-physics';

describe('desk physics shot', () => {
  it('uses a collider wide and long enough to prevent visible pen overlap', () => {
    expect(PEN_RADIUS).toBeGreaterThanOrEqual(0.13);
    expect(PEN_HALF_LENGTH).toBeGreaterThanOrEqual(1.4);
  });

  it('keeps a visibly spinning pen above the turn-settle threshold', () => {
    expect(penMotionSpeed(0, 2.5)).toBeCloseTo(3.5, 4);
    expect(penMotionSpeed(0.05, 0.4)).toBeGreaterThan(0.45);
  });
  it('distinguishes a fully supported center pen from an edge fall', () => {
    expect(isSafelyInsideDesk(0, 0.4)).toBe(true);
    expect(isSafelyInsideDesk(4.1, 0.4)).toBe(true);
    expect(isSafelyInsideDesk(5.4, 0.4)).toBe(false);
    expect(isSafelyInsideDesk(0, 7.5)).toBe(false);
    expect(shouldRecoverInteriorPen(0, DESK_TOP - 1, 0.4)).toBe(true);
    expect(shouldRecoverInteriorPen(5.4, DESK_TOP - 1, 0.4)).toBe(false);
  });

  it('uses configured table bounds for support and knockout recovery', () => {
    const narrow = challengeForLevel(19);
    expect(isSafelyInsideDesk(4, narrow.centerZ)).toBe(true);
    expect(isSafelyInsideDesk(4, narrow.centerZ, narrow)).toBe(false);
    expect(shouldRecoverInteriorPen(4, DESK_TOP - 1, narrow.centerZ, narrow)).toBe(false);
  });

  it('repairs only height without rewinding horizontal collision motion', () => {
    expect(interiorRecoveryPosition(
      { x: 1.8, y: DESK_TOP - 0.5, z: -0.7 },
      { x: 1.5, y: DESK_TOP + PEN_RADIUS, z: -0.9 },
    )).toEqual({ x: 1.8, y: DESK_TOP + PEN_RADIUS, z: -0.7 });
  });

  it('keeps two colliding pens separated after a direct center hit', async () => {
    const world = await startDeskWorld();
    const striker = new THREE.Group();
    const target = new THREE.Group();
    striker.position.set(-2.5, DESK_TOP + PEN_RADIUS, 0.4);
    target.position.set(1, DESK_TOP + PEN_RADIUS, 0.4);
    world.sync([striker, target], 2);
    world.strike(0, 0, 1, 0, 1);

    for (let index = 0; index < 180; index += 1) world.step(DESK_STEP);
    world.applyPoses([striker, target], 2);

    expect(striker.position.distanceTo(target.position)).toBeGreaterThan(2.4);
    expect(world.isOut(0)).toBe(false);
    expect(world.isOut(1)).toBe(false);
  });
  it('keeps the Rapier capsule aligned with the rendered pen barrel', () => {
    const render = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.72, 0));
    const physics = physicsQuaternionFromRender(render);
    const capsuleAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(physics);
    const renderAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(render);

    expect(capsuleAxis.angleTo(renderAxis)).toBeLessThan(1e-6);
    expect(Math.abs(capsuleAxis.y)).toBeLessThan(1e-6);
    expect(renderQuaternionFromPhysics(physics).angleTo(render)).toBeLessThan(1e-6);
  });

  it('puts a full pull at the top of the impulse range and a tip strike away from the center', () => {
    expect(impulseMagnitude(0, 1)).toBeCloseTo(1.1, 4);
    expect(impulseMagnitude(1, 1)).toBeGreaterThanOrEqual(21);
    expect(impulseMagnitude(1, 2)).toBeGreaterThan(impulseMagnitude(1, 1));
    expect(strikeDistance(0)).toBe(0);
    expect(strikeDistance(1)).toBeCloseTo(PEN_HALF_LENGTH * 0.9, 4);
    expect(strikeDistance(-2)).toBeCloseTo(-PEN_HALF_LENGTH * 0.9, 4);
  });

  it('keeps a full forward shot powerful after directional efficiency', () => {
    const forwardPower = axialShotEfficiency(1, 0, 1, 0);

    expect(impulseMagnitude(forwardPower, 1)).toBeGreaterThan(17);
  });

  it('preserves the intended AI impulse when converting it to the stronger power scale', () => {
    expect(impulseMagnitude(powerForImpulse(4.2, 1), 1)).toBeCloseTo(4.2, 4);
    expect(impulseMagnitude(powerForImpulse(11.2, 1), 1)).toBeCloseTo(11.2, 4);
  });

  it('delivers the stronger full-power impulse to the simulated pen', async () => {
    const world = await startDeskWorld();
    const pen = new THREE.Group();
    pen.position.set(0, DESK_TOP + PEN_RADIUS, 0.4);
    world.sync([pen], 1);
    world.strike(0, 0, 1, 0, 1);
    world.step(DESK_STEP);
    const velocities = [new THREE.Vector2()];
    const angular = [0];

    world.copyMotion(velocities, angular);

    expect(velocities[0]!.length()).toBeGreaterThan(19);
  });

  it('reconfigures the physical tabletop without weakening a full shot', async () => {
    const challenge = challengeForLevel(79);
    const world = await startDeskWorld();
    world.configure(challenge);
    const pen = new THREE.Group();
    pen.position.set(0, DESK_TOP + PEN_RADIUS, challenge.centerZ);
    world.sync([pen], 1);
    world.strike(0, 0, 1, 0, 1);
    world.step(DESK_STEP);
    const velocities = [new THREE.Vector2()];
    world.copyMotion(velocities, [0]);

    expect(world.challenge.level).toBe(79);
    expect(velocities[0]!.length()).toBeGreaterThan(19);
  });

  it('starts a bounded tremor only after a shot has been released', async () => {
    const challenge = challengeForLevel(59);
    const world = await startDeskWorld();
    world.configure(challenge);
    const pen = new THREE.Group();
    pen.position.set(0, DESK_TOP + PEN_RADIUS, challenge.centerZ);
    world.sync([pen], 1);

    for (let index = 0; index < 20; index += 1) expect(world.step(DESK_STEP).tremorStrength).toBe(0);
    world.strike(0, 0, 1, 0, 0.5);
    let strongest = 0;
    for (let index = 0; index < 90; index += 1) strongest = Math.max(strongest, world.step(DESK_STEP).tremorStrength);
    expect(strongest).toBeGreaterThan(0);
    expect(strongest).toBeLessThanOrEqual(0.25);
  });

  it('moves kinematic blockers predictably and removes them on reconfiguration', async () => {
    const challenge = challengeForLevel(69);
    const obstacle = challenge.obstacles[0];
    if (!obstacle) throw new Error('Moving-chalk challenge has no obstacle.');
    const world = await startDeskWorld();
    world.configure(challenge);
    const start = world.obstaclePose(obstacle.id);
    for (let index = 0; index < 120; index += 1) world.step(DESK_STEP);
    const moved = world.obstaclePose(obstacle.id);

    expect(start).not.toBeNull();
    expect(moved).not.toBeNull();
    expect(moved!.x).not.toBeCloseTo(start!.x, 2);
    world.configure(STANDARD_ARENA);
    expect(world.obstaclePose(obstacle.id)).toBeNull();
  });

  it('collides with a fixed bumper without dropping through the tabletop', async () => {
    const challenge = challengeForLevel(24);
    const obstacle = challenge.obstacles[0];
    if (!obstacle) throw new Error('Bumper challenge has no obstacle.');
    const world = await startDeskWorld();
    world.configure(challenge);
    const pen = new THREE.Group();
    pen.position.set(obstacle.x - 3.2, DESK_TOP + PEN_RADIUS, obstacle.z);
    pen.rotation.y = 0;
    world.sync([pen], 1);
    world.strike(0, 0, 1, 0, 0.7);

    let deflected = false;
    for (let index = 0; index < 240; index += 1) {
      world.step(DESK_STEP);
      world.applyPoses([pen], 1);
      expect(Number.isFinite(pen.position.x + pen.position.y + pen.position.z)).toBe(true);
      if (Math.abs(pen.position.z - obstacle.z) > 0.08) deflected = true;
      if (isSafelyInsideDesk(pen.position.x, pen.position.z, challenge)) {
        expect(pen.position.y).toBeGreaterThan(DESK_TOP - 0.2);
      }
    }

    expect(deflected || pen.position.x < obstacle.x + obstacle.halfWidth + PEN_HALF_LENGTH).toBe(true);
  });

  it('lets a pen retain more speed across a slick patch than the standard desk', async () => {
    const slickBase = challengeForLevel(49);
    const slick = {
      ...slickBase,
      frictionZones: [{ id: 'test-slick', x: 0, z: slickBase.centerZ, halfWidth: 3.2, halfDepth: 2.2, friction: 0.03 }],
    };
    const standardWorld = await startDeskWorld();
    const slickWorld = await startDeskWorld();
    slickWorld.configure(slick);
    const standardPen = new THREE.Group();
    const slickPen = new THREE.Group();
    standardPen.position.set(-1.8, DESK_TOP + PEN_RADIUS, STANDARD_ARENA.centerZ);
    slickPen.position.set(-1.8, DESK_TOP + PEN_RADIUS, slick.centerZ);
    standardWorld.sync([standardPen], 1);
    slickWorld.sync([slickPen], 1);
    standardWorld.strike(0, 0, 1, 0, 0.3);
    slickWorld.strike(0, 0, 1, 0, 0.3);

    for (let index = 0; index < 24; index += 1) {
      standardWorld.step(DESK_STEP);
      slickWorld.step(DESK_STEP);
    }
    const standardVelocity = [new THREE.Vector2()];
    const slickVelocity = [new THREE.Vector2()];
    standardWorld.copyMotion(standardVelocity, [0]);
    slickWorld.copyMotion(slickVelocity, [0]);

    expect(slickVelocity[0]!.length()).toBeGreaterThan(standardVelocity[0]!.length());
  });

  it('keeps moving-blocker contact finite and supported', async () => {
    const challenge = challengeForLevel(69);
    const obstacle = challenge.obstacles[0];
    if (!obstacle?.movement) throw new Error('Moving-chalk challenge has no moving obstacle.');
    const world = await startDeskWorld();
    world.configure(challenge);
    const pen = new THREE.Group();
    pen.position.set(obstacle.x, DESK_TOP + PEN_RADIUS, obstacle.z);
    pen.rotation.y = Math.PI / 2;
    world.sync([pen], 1);
    const startX = pen.position.x;

    for (let index = 0; index < 240; index += 1) {
      world.step(DESK_STEP);
      world.applyPoses([pen], 1);
      expect(Number.isFinite(pen.position.x + pen.position.y + pen.position.z)).toBe(true);
      if (isSafelyInsideDesk(pen.position.x, pen.position.z, challenge)) {
        expect(pen.position.y).toBeGreaterThan(DESK_TOP - 0.2);
      }
    }

    expect(Math.abs(pen.position.x - startX)).toBeGreaterThan(0.05);
  });

  it('cleans up old hazard bodies through repeated arena changes', async () => {
    const world = await startDeskWorld();
    const levels = [24, 39, 49, 69, 89, 99, 19, 59];

    for (let pass = 0; pass < 4; pass += 1) {
      for (const level of levels) {
        const previousIds = world.challenge.obstacles.map((obstacle) => obstacle.id);
        const next = challengeForLevel(level);
        world.configure(next);
        for (const id of previousIds) expect(world.obstaclePose(id)).toBeNull();
        for (const obstacle of next.obstacles) expect(world.obstaclePose(obstacle.id)).not.toBeNull();
        expect(world.step(DESK_STEP).substeps).toBe(1);
      }
    }
  });

  it('resolves a maximum-power champion shot without an interior vanish', async () => {
    const challenge = challengeForLevel(99);
    const world = await startDeskWorld();
    world.configure(challenge);
    const pen = new THREE.Group();
    const spawn = challenge.spawns[0];
    pen.position.set(spawn.x, DESK_TOP + PEN_RADIUS, spawn.z);
    pen.rotation.y = spawn.angle;
    world.sync([pen], 1);
    world.strike(0, 0, 0.2, -1, 1);

    let resolved = false;
    for (let index = 0; index < 1200; index += 1) {
      const result = world.step(DESK_STEP);
      world.applyPoses([pen], 1);
      expect(Number.isFinite(pen.position.x + pen.position.y + pen.position.z)).toBe(true);
      if (isSafelyInsideDesk(pen.position.x, pen.position.z, challenge)) {
        expect(pen.position.y).toBeGreaterThan(DESK_TOP - 0.2);
      }
      if (result.settled || world.isOut(0)) {
        resolved = true;
        break;
      }
    }

    expect(resolved).toBe(true);
  });

  it('survives repeated overlapping-pen contacts without either pen vanishing', async () => {
    const challenge = challengeForLevel(89);
    const world = await startDeskWorld();
    world.configure(challenge);
    const first = new THREE.Group();
    const second = new THREE.Group();

    for (let round = 0; round < 12; round += 1) {
      first.position.set(-0.02, DESK_TOP + PEN_RADIUS, challenge.centerZ);
      second.position.set(0.02, DESK_TOP + PEN_RADIUS, challenge.centerZ);
      first.rotation.y = round * 0.07;
      second.rotation.y = Math.PI - round * 0.05;
      world.sync([first, second], 2);
      world.strike(round % 2, 0.6, round % 2 ? -1 : 1, 0.08, 0.45);
      for (let index = 0; index < 180; index += 1) world.step(DESK_STEP);
      world.applyPoses([first, second], 2);

      for (const pen of [first, second]) {
        expect(Number.isFinite(pen.position.x + pen.position.y + pen.position.z)).toBe(true);
        if (isSafelyInsideDesk(pen.position.x, pen.position.z, challenge)) {
          expect(pen.position.y).toBeGreaterThan(DESK_TOP - 0.2);
          expect(world.isOut(pen === first ? 0 : 1)).toBe(false);
        }
      }
    }
  });

  it('uses opaque pen barrels so overlapping pens remain renderable', async () => {
    const scene = createClassroom();
    await scene.ready;
    const barrels = scene.heroPens.children.map((pen) => pen.getObjectByName('pen-cosmetic-barrel'));

    expect(barrels).toHaveLength(4);
    for (const barrel of barrels) {
      expect(barrel).toBeDefined();
      const material = (barrel as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
      expect(material.transmission).toBe(0);
    }
  });

  it('caps fixed simulation catch-up and discards stale backlog', async () => {
    const world = await startDeskWorld();
    expect(world.step(1).substeps).toBe(6);
    expect(world.step(0).substeps).toBe(0);
  });

  it('rests the real capsule flat at barrel height instead of standing on its end', async () => {
    const world = await startDeskWorld();
    const pen = new THREE.Group();
    pen.position.set(0, DESK_TOP + PEN_RADIUS, 0);
    pen.rotation.y = 0.72;
    world.sync([pen], 1);

    for (let index = 0; index < 120; index += 1) world.step(DESK_STEP);
    world.applyPoses([pen], 1);

    expect(pen.position.y).toBeLessThan(DESK_TOP + PEN_RADIUS * 3);
    expect(Math.abs(pen.rotation.x)).toBeLessThan(0.1);
    expect(Math.abs(pen.rotation.z)).toBeLessThan(0.1);
  });

  it('declares a pen out only after the rigid body falls below the desk', async () => {
    const world = await startDeskWorld();
    const pen = new THREE.Group();
    pen.position.set(7.5, DESK_TOP + PEN_RADIUS, 0);
    world.sync([pen], 1);

    expect(world.isOut(0)).toBe(false);
    world.strike(0, 0, 1, 0, 0.01);
    for (let index = 0; index < 60; index += 1) world.step(DESK_STEP);
    expect(world.isOut(0)).toBe(true);
  });

  it('spins a tip strike and lets a center strike run straighter', async () => {
    const scene = createClassroom();
    await scene.ready;
    scene.setMatchMode('practice');
    const pen = scene.heroPens.children[0];
    if (!pen) throw new Error('Player pen was not created.');

    scene.aim(0, 1.6, 1);
    scene.flick();
    const tipStart = pen.rotation.y;
    for (let frame = 0; frame < 8; frame += 1) scene.update(frame * 16, 0.016, true);
    const tipTurn = Math.abs(pen.rotation.y - tipStart);

    scene.setMatchMode('practice');
    scene.aim(0, 1.6, 0);
    scene.flick();
    const centerStart = pen.rotation.y;
    for (let frame = 0; frame < 8; frame += 1) scene.update(100 + frame * 16, 0.016, true);
    const centerTurn = Math.abs(pen.rotation.y - centerStart);

    expect(tipTurn).toBeGreaterThan(0.02);
    expect(tipTurn).toBeGreaterThan(centerTurn);
  });
});

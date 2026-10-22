import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../scene/textures', () => ({
  createBlackboardTexture: () => new THREE.Texture(),
  createTileTexture: () => new THREE.Texture(),
  createWoodTexture: () => new THREE.Texture(),
}));

import { createClassroom } from '../scene/classroom';
import { axialShotEfficiency } from './pen-rules';
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

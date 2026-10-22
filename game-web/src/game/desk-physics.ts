import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { STANDARD_ARENA, validateChallenge, type ArenaChallenge, type ArenaObstacle } from './arena-challenges';

export const DESK_STEP = 1 / 120;
export const DESK_MAX_SUBSTEPS = 6;
export const PEN_HALF_LENGTH = 1.4;
export const PEN_RADIUS = 0.16;
export const STRIKE_RANGE = 0.9;
export const DESK_TOP = 2.55;
export const PEN_OUT_Y = DESK_TOP - 0.2;
export const DESK_HALF_WIDTH = 5.75;
export const DESK_HALF_DEPTH = 7.45;
export const DESK_CENTER_Z = 0.4;
const IMPULSE_MIN = 1.1;
const IMPULSE_MAX = 21;
const REFERENCE_MASS = 1;
const CAPSULE_TO_RENDER = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 0, 1),
  -Math.PI / 2,
);
const RENDER_TO_CAPSULE = CAPSULE_TO_RENDER.clone().invert();

interface QuaternionLike {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
}

/** Compose the render yaw/tumble with Rapier's Y-axis capsule basis. */
export function physicsQuaternionFromRender(rotation: QuaternionLike): THREE.Quaternion {
  return new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).multiply(CAPSULE_TO_RENDER);
}

/** Remove Rapier's capsule basis before applying the pose to the Three.js pen. */
export function renderQuaternionFromPhysics(rotation: QuaternionLike): THREE.Quaternion {
  return new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w).multiply(RENDER_TO_CAPSULE);
}

export interface DeskHit {
  readonly x: number;
  readonly z: number;
  readonly strength: number;
}

export interface DeskStep {
  readonly hits: readonly DeskHit[];
  readonly substeps: number;
  readonly totalMotion: number;
  readonly settled: boolean;
  readonly tremorStrength: number;
}

interface Pose {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

interface PenBody {
  body: RAPIER.RigidBody;
  prev: Pose;
  curr: Pose;
  supported: BodyState;
}

interface VectorState { x: number; y: number; z: number }
interface BodyState {
  position: VectorState;
  rotation: QuaternionLike;
}

/** A conservative center zone where the pen is fully supported regardless of yaw. */
type ArenaBounds = Pick<ArenaChallenge, 'halfWidth' | 'halfDepth' | 'centerZ'>;

function yawFromQuaternion(rotation: QuaternionLike): number {
  return Math.atan2(
    2 * (rotation.w * rotation.y + rotation.x * rotation.z),
    1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z),
  );
}

export function confinedObstaclePosition(
  obstacle: Pick<ArenaObstacle, 'halfWidth' | 'halfDepth'>,
  bounds: ArenaBounds,
  x: number,
  z: number,
  rotation: number,
): { x: number; z: number } {
  const cosine = Math.abs(Math.cos(rotation));
  const sine = Math.abs(Math.sin(rotation));
  const projectedHalfWidth = cosine * obstacle.halfWidth + sine * obstacle.halfDepth;
  const projectedHalfDepth = sine * obstacle.halfWidth + cosine * obstacle.halfDepth;
  const margin = 0.25;
  const limitX = bounds.halfWidth - projectedHalfWidth - margin;
  const minZ = bounds.centerZ - bounds.halfDepth + projectedHalfDepth + margin;
  const maxZ = bounds.centerZ + bounds.halfDepth - projectedHalfDepth - margin;
  return {
    x: Math.max(-limitX, Math.min(limitX, x)),
    z: Math.max(minZ, Math.min(maxZ, z)),
  };
}

export function isSafelyInsideDesk(x: number, z: number, bounds: ArenaBounds = STANDARD_ARENA): boolean {
  const margin = PEN_HALF_LENGTH + PEN_RADIUS;
  return Math.abs(x) <= bounds.halfWidth - margin
    && Math.abs(z - bounds.centerZ) <= bounds.halfDepth - margin;
}

export function shouldRecoverInteriorPen(x: number, y: number, z: number, bounds: ArenaBounds = STANDARD_ARENA): boolean {
  return y < PEN_OUT_Y && isSafelyInsideDesk(x, z, bounds);
}

/** Lift a tunneled pen back onto the desk without undoing its horizontal collision response. */
export function interiorRecoveryPosition(
  current: Readonly<VectorState>,
  supported: Readonly<VectorState>,
): VectorState {
  return {
    x: current.x,
    y: Math.max(DESK_TOP + PEN_RADIUS, supported.y),
    z: current.z,
  };
}

function bodyState(body: RAPIER.RigidBody): BodyState {
  const position = body.translation();
  const rotation = body.rotation();
  return {
    position: { x: position.x, y: position.y, z: position.z },
    rotation: { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w },
  };
}

/** Impulse grows with pull power, and a heavier pen needs a harder shove to reach the same speed. */
export function impulseMagnitude(power: number, mass: number): number {
  const shaped = IMPULSE_MIN + Math.min(1, Math.max(0, power)) * (IMPULSE_MAX - IMPULSE_MIN);
  const scale = mass > 0 ? (mass / REFERENCE_MASS) ** 0.9 : 1;
  return shaped * scale;
}

/** Converts a desired impulse back to normalized strike power. */
export function powerForImpulse(impulse: number, mass: number): number {
  const scale = mass > 0 ? (mass / REFERENCE_MASS) ** 0.9 : 1;
  const normalized = (impulse / scale - IMPULSE_MIN) / (IMPULSE_MAX - IMPULSE_MIN);
  return Math.min(1, Math.max(0, normalized));
}

/** Maximum visible surface speed contributed by translation and rotation. */
export function penMotionSpeed(linearSpeed: number, angularSpeed: number): number {
  return Math.max(0, linearSpeed) + Math.max(0, angularSpeed) * PEN_HALF_LENGTH;
}

/** Distance from the pen center to the strike, in scene units. */
export function strikeDistance(strikeT: number): number {
  return Math.max(-1, Math.min(1, strikeT)) * PEN_HALF_LENGTH * STRIKE_RANGE;
}

function poseFromBody(body: RAPIER.RigidBody): Pose {
  const position = body.translation();
  const rotation = renderQuaternionFromPhysics(body.rotation());
  return {
    x: position.x,
    y: position.y,
    z: position.z,
    qx: rotation.x,
    qy: rotation.y,
    qz: rotation.z,
    qw: rotation.w,
  };
}

function samePose(pose: Pose): Pose {
  return { ...pose };
}

/**
 * Rigid desk and pen capsules. The world steps at 120 Hz and the meshes
 * are drawn between the last two poses.
 */
export class DeskWorld {
  readonly #rapier: typeof RAPIER;
  readonly #world: RAPIER.World;
  readonly #queue: RAPIER.EventQueue;
  readonly #pens: PenBody[] = [];
  readonly #penByCollider = new Map<number, number>();
  readonly #arenaBodies: RAPIER.RigidBody[] = [];
  readonly #reactiveChalk: { body: RAPIER.RigidBody; obstacle: ArenaObstacle }[] = [];
  readonly #obstacleBodies = new Map<string, RAPIER.RigidBody>();
  #challenge: ArenaChallenge = STANDARD_ARENA;
  #elapsed = 0;
  #tremorElapsed = -1;
  #tremorPulses = 0;
  #accumulator = 0;
  #alpha = 1;

  constructor(rapier: typeof RAPIER) {
    this.#rapier = rapier;
    this.#world = new rapier.World({ x: 0, y: -36, z: 0 });
    this.#world.timestep = DESK_STEP;
    this.#queue = new rapier.EventQueue(true);
    const floor = this.#world.createRigidBody(rapier.RigidBodyDesc.fixed().setTranslation(0, 0.15, 0.4));
    this.#world.createCollider(
      rapier.ColliderDesc.cuboid(18, 0.15, 22).setFriction(0.6).setRestitution(0.05),
      floor,
    );
    this.configure(STANDARD_ARENA);
    for (let index = 0; index < 4; index += 1) {
      const body = this.#world.createRigidBody(
        rapier.RigidBodyDesc.dynamic()
          .setTranslation(0, DESK_TOP + PEN_RADIUS, index)
          .setLinearDamping(2.4)
          .setAngularDamping(8.0)
          .setCcdEnabled(true)
          .setCanSleep(true),
      );
      const collider = this.#world.createCollider(
        rapier.ColliderDesc.capsule(PEN_HALF_LENGTH - PEN_RADIUS, PEN_RADIUS)
          .setMass(REFERENCE_MASS)
          .setFriction(0.42)
          .setRestitution(0.24)
          .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      const pose = poseFromBody(body);
      this.#pens.push({ body, prev: samePose(pose), curr: pose, supported: bodyState(body) });
      this.#penByCollider.set(collider.handle, index);
    }
  }

  get challenge(): ArenaChallenge { return this.#challenge; }

  configure(requested: ArenaChallenge): void {
    const challenge = validateChallenge(requested).valid ? requested : STANDARD_ARENA;
    for (const body of this.#arenaBodies.splice(0)) this.#world.removeRigidBody(body);
    this.#reactiveChalk.length = 0;
    this.#obstacleBodies.clear();
    for (const slot of this.#pens) slot.body.setBodyType(this.#rapier.RigidBodyType.Dynamic, false);
    this.#challenge = challenge;
    this.#elapsed = 0;
    this.#tremorElapsed = -1;
    this.#tremorPulses = 0;

    const desk = this.#world.createRigidBody(
      this.#rapier.RigidBodyDesc.fixed().setTranslation(0, DESK_TOP - 0.15, challenge.centerZ),
    );
    this.#world.createCollider(
      this.#rapier.ColliderDesc.cuboid(challenge.halfWidth, 0.15, challenge.halfDepth).setFriction(0.33).setRestitution(0.1),
      desk,
    );
    this.#arenaBodies.push(desk);

    for (const zone of challenge.frictionZones) {
      const body = this.#world.createRigidBody(this.#rapier.RigidBodyDesc.fixed().setTranslation(zone.x, DESK_TOP + 0.006, zone.z));
      this.#world.createCollider(
        this.#rapier.ColliderDesc.cuboid(zone.halfWidth, 0.006, zone.halfDepth).setFriction(zone.friction).setRestitution(0.05),
        body,
      );
      this.#arenaBodies.push(body);
    }

    for (const obstacle of challenge.obstacles) {
      const rotation = { x: 0, y: Math.sin(obstacle.rotation / 2), z: 0, w: Math.cos(obstacle.rotation / 2) };
      const descriptor = obstacle.kind === 'chalk'
        ? this.#rapier.RigidBodyDesc.dynamic()
          .enabledTranslations(true, false, true)
          .enabledRotations(false, true, false)
          .setLinearDamping(1.2)
          .setAngularDamping(2.4)
          .setCcdEnabled(true)
          .setCanSleep(false)
        : this.#rapier.RigidBodyDesc.fixed();
      const body = this.#world.createRigidBody(descriptor
        .setTranslation(obstacle.x, DESK_TOP + obstacle.height / 2, obstacle.z)
        .setRotation(rotation));
      const collider = obstacle.kind === 'bumper'
        ? this.#rapier.ColliderDesc.cylinder(obstacle.height / 2, obstacle.halfWidth)
        : this.#rapier.ColliderDesc.cuboid(obstacle.halfWidth, obstacle.height / 2, obstacle.halfDepth);
      collider.setFriction(0.48).setRestitution(0.18);
      if (obstacle.kind === 'chalk') collider.setMass(0.55);
      this.#world.createCollider(collider, body);
      this.#arenaBodies.push(body);
      this.#obstacleBodies.set(obstacle.id, body);
      if (obstacle.kind === 'chalk') this.#reactiveChalk.push({ body, obstacle });
    }
  }

  obstaclePose(id: string): { x: number; z: number; rotation: number } | null {
    const body = this.#obstacleBodies.get(id);
    if (!body) return null;
    const position = body.translation();
    const yaw = yawFromQuaternion(body.rotation());
    return { x: position.x, z: position.z, rotation: yaw };
  }

  #syncPen(index: number, pen: THREE.Object3D): void {
    const slot = this.#pens[index];
    if (!slot) return;
    slot.body.setEnabled(true);
    slot.body.setTranslation({
      x: pen.position.x,
      y: DESK_TOP + PEN_RADIUS,
      z: pen.position.z,
    }, true);
    const rotation = physicsQuaternionFromRender(pen.quaternion);
    slot.body.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w }, true);
    slot.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    slot.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    slot.body.sleep();
    slot.supported = bodyState(slot.body);
    const pose = poseFromBody(slot.body);
    slot.prev = samePose(pose);
    slot.curr = pose;
  }

  syncPen(index: number, pen: THREE.Object3D): void {
    this.#syncPen(index, pen);
    this.#accumulator = 0;
    this.#alpha = 1;
  }

  sync(pens: readonly THREE.Object3D[], count: number): void {
    for (let index = 0; index < this.#pens.length; index += 1) {
      const pen = pens[index];
      const slot = this.#pens[index];
      if (!slot) continue;
      if (!pen || index >= count || !pen.visible) {
        slot.body.setEnabled(false);
        continue;
      }
      this.#syncPen(index, pen);
    }
    this.#accumulator = 0;
    this.#alpha = 1;
  }

  strike(index: number, strikeT: number, dirX: number, dirZ: number, power: number): void {
    const slot = this.#pens[index];
    if (!slot || !slot.body.isEnabled()) return;
    const length = Math.hypot(dirX, dirZ);
    if (length < 1e-5 || power <= 0) return;
    if (this.#reactiveChalk.length > 0) {
      for (const pen of this.#pens) {
        if (!pen.body.isEnabled()) continue;
        pen.body.setBodyType(this.#rapier.RigidBodyType.Dynamic, pen === slot);
        if (pen !== slot) pen.body.sleep();
      }
    }
    const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(
      slot.body.rotation().x,
      slot.body.rotation().y,
      slot.body.rotation().z,
      slot.body.rotation().w,
    ));
    const along = strikeDistance(strikeT);
    const origin = slot.body.translation();
    const impulse = impulseMagnitude(power, slot.body.mass());
    slot.body.wakeUp();
    slot.body.applyImpulseAtPoint(
      { x: (dirX / length) * impulse, y: 0, z: (dirZ / length) * impulse },
      { x: origin.x + forward.x * along, y: origin.y, z: origin.z + forward.z * along },
      true,
    );
    if (this.#challenge.tremor) {
      this.#tremorElapsed = 0;
      this.#tremorPulses = 0;
    }
  }

  #advanceHazards(): number {
    this.#elapsed += DESK_STEP;
    for (const { body, obstacle } of this.#reactiveChalk) {
      const movement = obstacle.movement;
      const phase = movement ? this.#elapsed * movement.speed + movement.phase : 0;
      const offset = movement ? Math.sin(phase) * movement.amplitude : 0;
      const patrolVelocity = movement ? Math.cos(phase) * movement.amplitude * movement.speed : 0;
      const targetX = obstacle.x + (movement?.axis === 'x' ? offset : 0);
      const targetZ = obstacle.z + (movement?.axis === 'z' ? offset : 0);
      const position = body.translation();
      const velocity = body.linvel();
      const desiredX = (movement?.axis === 'x' ? patrolVelocity : 0) + (targetX - position.x) * 1.2;
      const desiredZ = (movement?.axis === 'z' ? patrolVelocity : 0) + (targetZ - position.z) * 1.2;
      body.setLinvel({
        x: velocity.x + (desiredX - velocity.x) * 0.012,
        y: 0,
        z: velocity.z + (desiredZ - velocity.z) * 0.012,
      }, true);

    }
    const tremor = this.#challenge.tremor;
    if (!tremor || this.#tremorElapsed < 0) return 0;
    this.#tremorElapsed += DESK_STEP;
    const nextPulse = tremor.delay + this.#tremorPulses * tremor.interval;
    if (this.#tremorPulses >= tremor.pulses || this.#tremorElapsed < nextPulse) return 0;
    const direction = this.#tremorPulses % 2 === 0 ? 1 : -1;
    for (const slot of this.#pens) {
      if (!slot.body.isEnabled() || slot.body.isSleeping()) continue;
      slot.body.applyImpulse({ x: direction * tremor.strength, y: 0, z: tremor.strength * 0.45 }, true);
    }
    this.#tremorPulses += 1;
    return tremor.strength;
  }

  /** Advances fixed physics and summarizes the simulated frame. */
  step(delta: number): DeskStep {
    this.#accumulator += Math.min(delta, 0.05);
    let steps = 0;
    const hits: DeskHit[] = [];
    let tremorStrength = 0;
    while (this.#accumulator >= DESK_STEP && steps < DESK_MAX_SUBSTEPS) {
      tremorStrength = Math.max(tremorStrength, this.#advanceHazards());
      for (const slot of this.#pens) {
        slot.prev = samePose(slot.curr);
        const position = slot.body.translation();
        if (slot.body.isEnabled() && position.y >= DESK_TOP + PEN_RADIUS * 0.5 && isSafelyInsideDesk(position.x, position.z, this.#challenge)) {
          slot.supported = bodyState(slot.body);
        }
      }
      this.#world.step(this.#queue);
      for (const { body, obstacle } of this.#reactiveChalk) {
        const position = body.translation();
        const safe = confinedObstaclePosition(obstacle, this.#challenge, position.x, position.z, yawFromQuaternion(body.rotation()));
        if (safe.x === position.x && safe.z === position.z) continue;
        const velocity = body.linvel();
        body.setTranslation({ x: safe.x, y: DESK_TOP + obstacle.height / 2, z: safe.z }, true);
        body.setLinvel({
          x: safe.x === position.x ? velocity.x : -velocity.x * 0.2,
          y: 0,
          z: safe.z === position.z ? velocity.z : -velocity.z * 0.2,
        }, true);
      }
      for (const slot of this.#pens) {
        if (!slot.body.isEnabled()) continue;
        const position = slot.body.translation();
        if (!shouldRecoverInteriorPen(position.x, position.y, position.z, this.#challenge)) continue;
        const safe = slot.supported;
        const linearVelocity = slot.body.linvel();
        const angularVelocity = slot.body.angvel();
        slot.body.setTranslation(interiorRecoveryPosition(position, safe.position), false);
        slot.body.setRotation(safe.rotation, false);
        slot.body.setLinvel({ x: linearVelocity.x, y: 0, z: linearVelocity.z }, false);
        slot.body.setAngvel(angularVelocity, true);
      }
      this.#queue.drainCollisionEvents((handleA, handleB, started) => {
        if (!started) return;
        const indexA = this.#penByCollider.get(handleA);
        const indexB = this.#penByCollider.get(handleB);
        if (indexA === undefined || indexB === undefined) return;
        const bodyA = this.#pens[indexA]?.body;
        const bodyB = this.#pens[indexB]?.body;
        if (!bodyA || !bodyB) return;
        const velocityA = bodyA.linvel();
        const velocityB = bodyB.linvel();
        const strength = Math.hypot(velocityA.x - velocityB.x, velocityA.y - velocityB.y, velocityA.z - velocityB.z);
        if (strength < 1.2) return;
        const positionA = bodyA.translation();
        const positionB = bodyB.translation();
        hits.push({ x: (positionA.x + positionB.x) / 2, z: (positionA.z + positionB.z) / 2, strength });
      });
      for (const slot of this.#pens) slot.curr = poseFromBody(slot.body);
      this.#accumulator -= DESK_STEP;
      steps += 1;
    }
    if (steps === DESK_MAX_SUBSTEPS) this.#accumulator = 0;
    this.#alpha = this.#accumulator / DESK_STEP;
    let totalMotion = 0;
    let settled = true;
    for (const slot of this.#pens) {
      if (!slot.body.isEnabled()) continue;
      const linear = slot.body.linvel();
      const angular = slot.body.angvel();
      const linSpeed = Math.hypot(linear.x, linear.y, linear.z);
      const angSpeed = Math.hypot(angular.x, angular.y, angular.z);
      const motion = slot.body.isSleeping() ? 0 : penMotionSpeed(linSpeed, angSpeed);
      totalMotion += motion;
      if (!slot.body.isSleeping() && motion >= 0.45) settled = false;
    }
    if (settled) this.#tremorElapsed = -1;
    return { hits, substeps: steps, totalMotion, settled, tremorStrength };
  }

  applyPoses(pens: readonly THREE.Object3D[], count: number): void {
    const alpha = this.#alpha;
    for (let index = 0; index < count; index += 1) {
      const pen = pens[index];
      const slot = this.#pens[index];
      if (!pen || !slot || !slot.body.isEnabled() || !pen.visible) continue;
      pen.position.set(
        THREE.MathUtils.lerp(slot.prev.x, slot.curr.x, alpha),
        THREE.MathUtils.lerp(slot.prev.y, slot.curr.y, alpha),
        THREE.MathUtils.lerp(slot.prev.z, slot.curr.z, alpha),
      );
      const previous = new THREE.Quaternion(slot.prev.qx, slot.prev.qy, slot.prev.qz, slot.prev.qw);
      const current = new THREE.Quaternion(slot.curr.qx, slot.curr.qy, slot.curr.qz, slot.curr.qw);
      if (previous.dot(current) < 0) current.set(-current.x, -current.y, -current.z, -current.w);
      pen.quaternion.slerpQuaternions(previous, current, alpha);
    }
  }

  copyMotion(velocities: readonly THREE.Vector2[], angular: number[]): number {
    let total = 0;
    for (let index = 0; index < velocities.length; index += 1) {
      const slot = this.#pens[index];
      const velocity = velocities[index];
      if (!slot || !velocity || !slot.body.isEnabled()) continue;
      const linear = slot.body.linvel();
      const spin = slot.body.angvel();
      velocity.set(linear.x, linear.z);
      angular[index] = spin.y;
      total += Math.hypot(linear.x, linear.y, linear.z) + Math.hypot(spin.x, spin.y, spin.z) * 0.45;
    }
    return total;
  }

  isOut(index: number): boolean {
    const slot = this.#pens[index];
    if (!slot?.body.isEnabled()) return false;
    const position = slot.body.translation();
    return position.y < PEN_OUT_Y && !isSafelyInsideDesk(position.x, position.z, this.#challenge);
  }

  release(index: number): void {
    const slot = this.#pens[index];
    if (!slot) return;
    slot.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    slot.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    slot.body.setEnabled(false);
  }

  sleepPens(): void {
    for (const slot of this.#pens) {
      if (!slot.body.isEnabled()) continue;
      slot.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      slot.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      slot.body.sleep();
      if (this.#reactiveChalk.length > 0) slot.body.setBodyType(this.#rapier.RigidBodyType.Fixed, false);
      const pose = poseFromBody(slot.body);
      slot.prev = samePose(pose);
      slot.curr = pose;
    }
  }
}

let rapierReady: Promise<typeof RAPIER> | null = null;

function loadRapier(): Promise<typeof RAPIER> {
  if (!rapierReady) {
    rapierReady = import('@dimforge/rapier3d-compat').then(async (mod) => {
      await mod.default.init();
      return mod.default;
    });
  }
  return rapierReady;
}

export function startDeskWorld(): Promise<DeskWorld> {
  return loadRapier().then((rapier) => new DeskWorld(rapier));
}

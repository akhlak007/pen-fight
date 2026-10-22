export type ArenaHazard = 'standard' | 'training' | 'narrow' | 'bumper' | 'rulers' | 'slick' | 'tremor' | 'moving-chalk' | 'short' | 'mixed' | 'champion';

export interface ArenaSpawn {
  readonly x: number;
  readonly z: number;
  readonly angle: number;
}

export interface ArenaMovement {
  readonly axis: 'x' | 'z';
  readonly amplitude: number;
  readonly speed: number;
  readonly phase: number;
}

export interface ArenaObstacle {
  readonly id: string;
  readonly kind: 'bumper' | 'ruler' | 'chalk';
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly height: number;
  readonly rotation: number;
  readonly movement?: ArenaMovement;
}

export interface ArenaFrictionZone {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly friction: number;
}

export interface ArenaTremor {
  readonly delay: number;
  readonly interval: number;
  readonly strength: number;
  readonly pulses: number;
}

export interface ArenaChallenge {
  readonly level: number;
  readonly tier: number;
  readonly difficulty: number;
  readonly name: string;
  readonly hazard: ArenaHazard;
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly centerZ: number;
  readonly spawns: readonly [ArenaSpawn, ArenaSpawn];
  readonly obstacles: readonly ArenaObstacle[];
  readonly frictionZones: readonly ArenaFrictionZone[];
  readonly tremor: ArenaTremor | null;
  readonly ai: {
    readonly aimError: number;
    readonly minImpulse: number;
    readonly maxImpulse: number;
  };
}

const BASE_WIDTH = 5.75;
const BASE_DEPTH = 7.45;
const CENTER_Z = 0.4;
const BASE_SPAWNS: readonly [ArenaSpawn, ArenaSpawn] = [
  { x: -2.2, z: 4.7, angle: 1.08 },
  { x: 2.2, z: -3.9, angle: -2.05 },
];

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

interface ObstacleEnvelope { readonly x: number; readonly z: number; readonly halfWidth: number; readonly halfDepth: number }

function obstacleEnvelope(obstacle: ArenaObstacle): ObstacleEnvelope {
  const cosine = Math.abs(Math.cos(obstacle.rotation));
  const sine = Math.abs(Math.sin(obstacle.rotation));
  return {
    x: obstacle.x,
    z: obstacle.z,
    halfWidth: cosine * obstacle.halfWidth + sine * obstacle.halfDepth + (obstacle.movement?.axis === 'x' ? obstacle.movement.amplitude : 0),
    halfDepth: sine * obstacle.halfWidth + cosine * obstacle.halfDepth + (obstacle.movement?.axis === 'z' ? obstacle.movement.amplitude : 0),
  };
}

function hasOpenRoute(challenge: ArenaChallenge, envelopes: readonly ObstacleEnvelope[]): boolean {
  const step = 0.35;
  const clearance = 0.42;
  const minX = -challenge.halfWidth + clearance;
  const maxX = challenge.halfWidth - clearance;
  const minZ = challenge.centerZ - challenge.halfDepth + clearance;
  const maxZ = challenge.centerZ + challenge.halfDepth - clearance;
  const columns = Math.floor((maxX - minX) / step) + 1;
  const rows = Math.floor((maxZ - minZ) / step) + 1;
  const key = (column: number, row: number) => row * columns + column;
  const cell = (position: ArenaSpawn) => ({
    column: Math.max(0, Math.min(columns - 1, Math.round((position.x - minX) / step))),
    row: Math.max(0, Math.min(rows - 1, Math.round((position.z - minZ) / step))),
  });
  const blocked = (column: number, row: number) => {
    const x = minX + column * step;
    const z = minZ + row * step;
    return envelopes.some((obstacle) => Math.abs(x - obstacle.x) <= obstacle.halfWidth + clearance
      && Math.abs(z - obstacle.z) <= obstacle.halfDepth + clearance);
  };
  const start = cell(challenge.spawns[0]);
  const goal = cell(challenge.spawns[1]);
  const queue = [start];
  const visited = new Set([key(start.column, start.row)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor]!;
    if (current.column === goal.column && current.row === goal.row) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const column = current.column + dx;
      const row = current.row + dz;
      const id = key(column, row);
      if (column < 0 || column >= columns || row < 0 || row >= rows || visited.has(id) || blocked(column, row)) continue;
      visited.add(id);
      queue.push({ column, row });
    }
  }
  return false;
}

function baseChallenge(level: number, tier: number, name: string, hazard: ArenaHazard): ArenaChallenge {
  const insideTier = tier === 1 ? level - 1 : (level - 10) % 10;
  const progress = insideTier / (tier === 1 ? 8 : 9);
  const spawnShift = ((level * 7) % 9 - 4) * 0.08;
  return {
    level,
    tier,
    difficulty: level,
    name,
    hazard,
    halfWidth: BASE_WIDTH,
    halfDepth: BASE_DEPTH,
    centerZ: CENTER_Z,
    spawns: [
      { x: round(BASE_SPAWNS[0].x + spawnShift), z: round(BASE_SPAWNS[0].z - progress * 0.12), angle: round(BASE_SPAWNS[0].angle + spawnShift * 0.06) },
      { x: round(BASE_SPAWNS[1].x - spawnShift), z: round(BASE_SPAWNS[1].z + progress * 0.12), angle: round(BASE_SPAWNS[1].angle - spawnShift * 0.06) },
    ],
    obstacles: [],
    frictionZones: [],
    tremor: null,
    ai: {
      aimError: round(Math.max(0.035, 0.18 - level * 0.00135)),
      minImpulse: round(4.8 + level * 0.045),
      maxImpulse: round(12 + level * 0.075),
    },
  };
}

export const STANDARD_ARENA: ArenaChallenge = Object.freeze({
  ...baseChallenge(1, 0, 'Classic Classroom', 'standard'),
  spawns: BASE_SPAWNS,
  ai: { aimError: 0.14, minImpulse: 4.2, maxImpulse: 11.2 },
});

function generatedChallenge(level: number): ArenaChallenge {
  const tier = level <= 9 ? 1 : Math.min(10, Math.floor(level / 10) + 1);
  const index = tier === 1 ? level - 1 : (level - 10) % 10;
  const progress = index / (tier === 1 ? 8 : 9);
  const names = ['Training Desk', 'Narrow Edges', 'Center Bumper', 'Ruler Gates', 'Slick Patches', 'Desk Tremors', 'Moving Chalk', 'Short Desk', 'Mixed Trial', 'Champion Desk'] as const;
  const hazards: readonly ArenaHazard[] = ['training', 'narrow', 'bumper', 'rulers', 'slick', 'tremor', 'moving-chalk', 'short', 'mixed', 'champion'];
  const base = baseChallenge(level, tier, names[tier - 1]!, hazards[tier - 1]!);

  if (tier === 1) {
    if (level === 1) return base;
    if (level === 2) return { ...base, name: 'Tight Lines', hazard: 'narrow', halfWidth: 5.4 };
    if (level === 3) return {
      ...base,
      name: 'First Bumper',
      hazard: 'bumper',
      obstacles: [{ id: 'training-bumper-3', kind: 'bumper', x: 0, z: CENTER_Z, halfWidth: 0.34, halfDepth: 0.34, height: 0.26, rotation: 0 }],
    };
    if (level === 4) return {
      ...base,
      name: 'Chalk Gate',
      hazard: 'rulers',
      obstacles: [
        { id: 'training-gate-left-4', kind: 'chalk', x: -1.55, z: CENTER_Z + 0.55, halfWidth: 0.12, halfDepth: 0.85, height: 0.2, rotation: 0.12, movement: { axis: 'z', amplitude: 0.42, speed: 0.28, phase: 0 } },
        { id: 'training-gate-right-4', kind: 'chalk', x: 1.55, z: CENTER_Z - 0.55, halfWidth: 0.12, halfDepth: 0.85, height: 0.2, rotation: -0.12, movement: { axis: 'z', amplitude: 0.42, speed: 0.28, phase: Math.PI } },
      ],
    };
    if (level === 5) return {
      ...base,
      name: 'Slick Lesson',
      hazard: 'slick',
      frictionZones: [{ id: 'training-slick-5', x: 0, z: CENTER_Z, halfWidth: 1.1, halfDepth: 1.15, friction: 0.14 }],
    };
    if (level === 6) return {
      ...base,
      name: 'Wobbly Desk',
      hazard: 'tremor',
      tremor: { delay: 0.3, interval: 0.28, strength: 0.06, pulses: 1 },
    };
    if (level === 7) return {
      ...base,
      name: 'Moving Chalk',
      hazard: 'moving-chalk',
      obstacles: [{
        id: 'training-chalk-7',
        kind: 'chalk',
        x: 0,
        z: CENTER_Z,
        halfWidth: 0.42,
        halfDepth: 0.2,
        height: 0.24,
        rotation: 0,
        movement: { axis: 'x', amplitude: 1.1, speed: 0.35, phase: 0 },
      }],
    };
    if (level === 8) return { ...base, name: 'Short Practice', hazard: 'short', halfDepth: 6.85 };
    return {
      ...base,
      name: 'Graduation Trial',
      hazard: 'mixed',
      halfWidth: 5.25,
      halfDepth: 6.9,
      obstacles: [{ id: 'training-final-bumper-9', kind: 'bumper', x: 0.7, z: CENTER_Z, halfWidth: 0.36, halfDepth: 0.36, height: 0.27, rotation: 0 }],
      frictionZones: [{ id: 'training-final-slick-9', x: -1.55, z: CENTER_Z - 0.8, halfWidth: 0.75, halfDepth: 0.85, friction: 0.13 }],
    };
  }
  if (tier === 2) return { ...base, halfWidth: round(BASE_WIDTH - 0.35 - progress * 0.55) };
  if (tier === 3) return {
    ...base,
    obstacles: [{
      id: `bumper-${level}`,
      kind: 'bumper',
      x: round((index % 2 === 0 ? -1 : 1) * (0.45 + progress * 0.45)),
      z: round(CENTER_Z + (index % 3 - 1) * 0.38),
      halfWidth: round(0.38 + progress * 0.1),
      halfDepth: round(0.38 + progress * 0.1),
      height: 0.3,
      rotation: 0,
    }],
  };
  if (tier === 4) return {
    ...base,
    obstacles: [
      { id: `left-ruler-${level}`, kind: 'ruler', x: -2.15, z: round(CENTER_Z + 0.9 - progress * 0.35), halfWidth: 0.12, halfDepth: round(1.05 + progress * 0.2), height: 0.22, rotation: round(0.28 + progress * 0.12) },
      { id: `right-ruler-${level}`, kind: 'ruler', x: 2.15, z: round(CENTER_Z - 0.9 + progress * 0.35), halfWidth: 0.12, halfDepth: round(1.05 + progress * 0.2), height: 0.22, rotation: round(-0.28 - progress * 0.12) },
    ],
  };
  if (tier === 5) return {
    ...base,
    frictionZones: [{ id: `slick-${level}`, x: round((index % 3 - 1) * 1.05), z: round(CENTER_Z + (index % 2 ? 1.1 : -1.1)), halfWidth: round(1.05 + progress * 0.35), halfDepth: round(1.25 + progress * 0.3), friction: round(0.12 - progress * 0.06) }],
  };
  if (tier === 6) return {
    ...base,
    tremor: { delay: round(0.28 - progress * 0.08), interval: round(0.24 - progress * 0.05), strength: round(0.08 + progress * 0.16), pulses: 1 + Math.floor(progress * 3) },
  };
  if (tier === 7) return {
    ...base,
    obstacles: [{
      id: `chalk-${level}`,
      kind: 'chalk',
      x: 0,
      z: round(CENTER_Z + (index % 2 ? 0.75 : -0.75)),
      halfWidth: round(0.48 + progress * 0.12),
      halfDepth: 0.24,
      height: 0.28,
      rotation: 0,
      movement: { axis: 'x', amplitude: round(1.4 + progress * 0.9), speed: round(0.45 + progress * 0.35), phase: round(index * 0.37) },
    }],
  };
  if (tier === 8) return { ...base, halfDepth: round(BASE_DEPTH - 0.5 - progress * 0.5) };
  if (tier === 9) return {
    ...base,
    halfWidth: round(BASE_WIDTH - 0.4 - progress * 0.3),
    obstacles: [{ id: `mixed-bumper-${level}`, kind: 'bumper', x: round(index % 2 ? 1.1 : -1.1), z: CENTER_Z, halfWidth: 0.42, halfDepth: 0.42, height: 0.3, rotation: 0 }],
    frictionZones: [{ id: `mixed-slick-${level}`, x: round(index % 2 ? -2 : 2), z: round(CENTER_Z + (index % 3 - 1) * 1.15), halfWidth: 0.9, halfDepth: 1.05, friction: round(0.08 - progress * 0.03) }],
  };
  return {
    ...base,
    halfWidth: round(5.05 - progress * 0.3),
    halfDepth: round(6.85 - progress * 0.35),
    obstacles: [
      { id: `champion-left-${level}`, kind: 'chalk', x: -1.2, z: round(CENTER_Z + 1.15), halfWidth: 0.42, halfDepth: 0.22, height: 0.3, rotation: 0, movement: { axis: 'x', amplitude: round(0.75 + progress * 0.35), speed: round(0.55 + progress * 0.25), phase: 0 } },
      { id: `champion-right-${level}`, kind: 'chalk', x: 1.2, z: round(CENTER_Z - 1.15), halfWidth: 0.42, halfDepth: 0.22, height: 0.3, rotation: 0, movement: { axis: 'x', amplitude: round(0.75 + progress * 0.35), speed: round(0.55 + progress * 0.25), phase: 1.7 } },
    ],
    tremor: { delay: 0.2, interval: 0.2, strength: round(0.12 + progress * 0.12), pulses: 2 + Math.floor(progress * 2) },
  };
}

export function validateChallenge(challenge: ArenaChallenge): { valid: true } | { valid: false; reason: string } {
  const finite = [challenge.level, challenge.tier, challenge.difficulty, challenge.halfWidth, challenge.halfDepth, challenge.centerZ].every(Number.isFinite);
  if (!finite || challenge.halfWidth < 4.6 || challenge.halfWidth > BASE_WIDTH || challenge.halfDepth < 6.4 || challenge.halfDepth > BASE_DEPTH) return { valid: false, reason: 'unsupported table bounds' };
  if (![challenge.ai.aimError, challenge.ai.minImpulse, challenge.ai.maxImpulse].every(Number.isFinite)
    || challenge.ai.aimError < 0.02 || challenge.ai.aimError > 0.2
    || challenge.ai.minImpulse < 3.5 || challenge.ai.maxImpulse >= 21 || challenge.ai.minImpulse > challenge.ai.maxImpulse) return { valid: false, reason: 'unsafe AI settings' };
  const ids = new Set<string>();
  const envelopes: ObstacleEnvelope[] = [];
  for (const spawn of challenge.spawns) {
    if (![spawn.x, spawn.z, spawn.angle].every(Number.isFinite)) return { valid: false, reason: 'invalid spawn' };
    if (Math.abs(spawn.x) >= challenge.halfWidth - 1.55 || Math.abs(spawn.z - challenge.centerZ) >= challenge.halfDepth - 1.55) return { valid: false, reason: 'unsafe spawn' };
  }
  for (const obstacle of challenge.obstacles) {
    if (ids.has(obstacle.id)) return { valid: false, reason: 'duplicate obstacle' };
    ids.add(obstacle.id);
    if (![obstacle.x, obstacle.z, obstacle.halfWidth, obstacle.halfDepth, obstacle.height, obstacle.rotation].every(Number.isFinite)
      || obstacle.halfWidth <= 0 || obstacle.halfDepth <= 0 || obstacle.height <= 0) return { valid: false, reason: 'invalid obstacle' };
    const envelope = obstacleEnvelope(obstacle);
    const extentX = envelope.halfWidth;
    const extentZ = envelope.halfDepth;
    if (Math.abs(obstacle.x) + extentX >= challenge.halfWidth - 0.2 || Math.abs(obstacle.z - challenge.centerZ) + extentZ >= challenge.halfDepth - 0.2) return { valid: false, reason: 'obstacle outside table' };
    if (obstacle.movement && (![obstacle.movement.amplitude, obstacle.movement.speed, obstacle.movement.phase].every(Number.isFinite)
      || obstacle.movement.speed > 1.2 || obstacle.movement.amplitude > 2.5 || obstacle.movement.speed <= 0 || obstacle.movement.amplitude <= 0)) return { valid: false, reason: 'unsafe obstacle movement' };
    for (const spawn of challenge.spawns) {
      if (Math.abs(spawn.x - obstacle.x) <= extentX + 1.55 && Math.abs(spawn.z - obstacle.z) <= extentZ + 1.55) return { valid: false, reason: 'blocked spawn' };
    }
    envelopes.push(envelope);
  }
  for (let first = 0; first < envelopes.length; first += 1) {
    for (let second = first + 1; second < envelopes.length; second += 1) {
      const a = envelopes[first]!;
      const b = envelopes[second]!;
      if (Math.abs(a.x - b.x) < a.halfWidth + b.halfWidth + 0.2
        && Math.abs(a.z - b.z) < a.halfDepth + b.halfDepth + 0.2) return { valid: false, reason: 'overlapping obstacles' };
    }
  }
  if (!hasOpenRoute(challenge, envelopes)) return { valid: false, reason: 'no open route' };
  for (const zone of challenge.frictionZones) {
    if (ids.has(zone.id)) return { valid: false, reason: 'duplicate hazard' };
    ids.add(zone.id);
    if (![zone.x, zone.z, zone.halfWidth, zone.halfDepth, zone.friction].every(Number.isFinite)
      || zone.halfWidth <= 0 || zone.halfDepth <= 0 || zone.friction < 0.02 || zone.friction > 0.2
      || Math.abs(zone.x) + zone.halfWidth >= challenge.halfWidth - 0.2
      || Math.abs(zone.z - challenge.centerZ) + zone.halfDepth >= challenge.halfDepth - 0.2) return { valid: false, reason: 'invalid friction zone' };
  }
  if (challenge.tremor && (![challenge.tremor.delay, challenge.tremor.interval, challenge.tremor.strength, challenge.tremor.pulses].every(Number.isFinite)
    || challenge.tremor.strength > 0.25 || challenge.tremor.strength <= 0 || challenge.tremor.pulses > 4 || challenge.tremor.pulses < 1
    || challenge.tremor.delay < 0.15 || challenge.tremor.interval < 0.15)) return { valid: false, reason: 'unsafe tremor' };
  return { valid: true };
}

export function challengeForLevel(input: number): ArenaChallenge {
  const level = Math.max(1, Math.min(99, Math.floor(Number.isFinite(input) ? input : 1)));
  const challenge = generatedChallenge(level);
  return validateChallenge(challenge).valid ? challenge : { ...STANDARD_ARENA, level, difficulty: level };
}

/** Produces the level-scaled AI impulse while keeping it below player maximum power. */
export function aiImpulseForDistance(challenge: ArenaChallenge, distance: number): number {
  const desired = Math.max(0, distance) * 1.2 + 1.2 + challenge.difficulty * 0.075;
  return Math.max(challenge.ai.minImpulse, Math.min(challenge.ai.maxImpulse, desired));
}

export function safeAiShotAngle(
  challenge: ArenaChallenge,
  origin: Readonly<{ x: number; z: number }>,
  target: Readonly<{ x: number; z: number }>,
  requestedError: number,
): number | null {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const distance = Math.hypot(dx, dz);
  const direct = Math.atan2(-dz, dx);
  if (distance < 0.001) return direct;
  const candidates = [requestedError, requestedError * 0.5, 0, -requestedError * 0.5, -requestedError, 0.18, -0.18, 0.32, -0.32, 0.48, -0.48];
  const envelopes = challenge.obstacles.map(obstacleEnvelope);
  const safeMargin = 0.5;
  const clear = (angle: number) => {
    for (let sample = 1; sample <= 30; sample += 1) {
      const travel = distance * (sample / 30);
      const x = origin.x + Math.cos(angle) * travel;
      const z = origin.z - Math.sin(angle) * travel;
      if (Math.abs(x) > challenge.halfWidth - safeMargin || Math.abs(z - challenge.centerZ) > challenge.halfDepth - safeMargin) return false;
      if (envelopes.some((obstacle) => Math.abs(x - obstacle.x) <= obstacle.halfWidth + 0.28
        && Math.abs(z - obstacle.z) <= obstacle.halfDepth + 0.28)) return false;
    }
    return true;
  };
  for (const error of candidates) {
    const angle = direct + error;
    if (clear(angle)) return angle;
  }
  return null;
}

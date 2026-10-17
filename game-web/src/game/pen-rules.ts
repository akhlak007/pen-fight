export interface Vec2 { readonly x: number; readonly y: number }
export interface CapsuleContact { readonly normal: Vec2; readonly penetration: number }
export interface FlickAim { readonly direction: Vec2; readonly power: number; readonly pullDistance: number }
export type KnockoutOutcome = 0 | 1 | 'draw' | null;

export const TABLE_BOUNDS = Object.freeze({ centerZ: 0.4, halfWidth: 5.75, halfDepth: 7.45 });
export const PLAYER_CORNER = Object.freeze({ x: -2.2, z: 4.7 });
export const AI_CORNER = Object.freeze({ x: 2.2, z: -3.9 });

export function isOutsideTable(x: number, z: number): boolean {
  return Math.abs(x) > TABLE_BOUNDS.halfWidth || Math.abs(z - TABLE_BOUNDS.centerZ) > TABLE_BOUNDS.halfDepth;
}

/**
 * Uses the visible pen body rather than its center to decide whether gravity
 * should take over. A pen can teeter at the edge, but falls once less than
 * half of its sampled body remains above the tabletop.
 */
export function penHasFallen(
  x: number,
  z: number,
  angle: number,
  halfLength = 1.82,
): boolean {
  let supported = 0;
  const samples = 9;
  const forwardX = Math.cos(angle);
  const forwardZ = -Math.sin(angle);
  for (let index = 0; index < samples; index += 1) {
    const along = -halfLength + (halfLength * 2 * index) / (samples - 1);
    if (!isOutsideTable(x + forwardX * along, z + forwardZ * along)) supported += 1;
  }
  return supported < Math.ceil(samples / 2);
}

/** Converts a screen-space pull gesture into the opposite tabletop shot. */
export function computeFlickAim(deltaX: number, deltaY: number, maximumPull = 180): FlickAim {
  const pullDistance = Math.min(Math.hypot(deltaX, deltaY), maximumPull);
  if (pullDistance < 0.001) {
    return { direction: { x: 0, y: -1 }, power: 0, pullDistance: 0 };
  }
  const rawDistance = Math.hypot(deltaX, deltaY);
  return {
    direction: { x: -deltaX / rawDistance, y: -deltaY / rawDistance },
    power: clamp01(pullDistance / maximumPull),
    pullDistance,
  };
}

/** Adds a small magnetic correction only when the shot already points toward the rival. */
export function assistedDirection(
  direction: Vec2,
  targetDirection: Vec2,
  strength = 0.16,
  coneThreshold = 0.35,
): Vec2 {
  const targetLength = Math.hypot(targetDirection.x, targetDirection.y);
  const directionLength = Math.hypot(direction.x, direction.y);
  if (targetLength < 0.001 || directionLength < 0.001) return direction;
  const source = { x: direction.x / directionLength, y: direction.y / directionLength };
  const target = { x: targetDirection.x / targetLength, y: targetDirection.y / targetLength };
  if (dot(source, target) < coneThreshold) return direction;
  const blended = {
    x: source.x * (1 - strength) + target.x * strength,
    y: source.y * (1 - strength) + target.y * strength,
  };
  const blendedLength = Math.hypot(blended.x, blended.y) || 1;
  return { x: blended.x / blendedLength, y: blended.y / blendedLength };
}

export function knockoutWinner(playerOut: boolean, aiOut: boolean): KnockoutOutcome {
  if (!playerOut && !aiOut) return null;
  if (playerOut && aiOut) return 'draw';
  return aiOut && !playerOut ? 0 : 1;
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
function dot(a: Vec2, b: Vec2): number { return a.x * b.x + a.y * b.y; }

export function capsuleContact(
  centerA: Vec2,
  angleA: number,
  centerB: Vec2,
  angleB: number,
  halfLength = 1.82,
  radius = 0.2,
): CapsuleContact | null {
  const axisA = { x: Math.cos(angleA) * halfLength, y: -Math.sin(angleA) * halfLength };
  const axisB = { x: Math.cos(angleB) * halfLength, y: -Math.sin(angleB) * halfLength };
  const startA = { x: centerA.x - axisA.x, y: centerA.y - axisA.y };
  const startB = { x: centerB.x - axisB.x, y: centerB.y - axisB.y };
  const directionA = { x: axisA.x * 2, y: axisA.y * 2 };
  const directionB = { x: axisB.x * 2, y: axisB.y * 2 };
  const betweenStarts = { x: startA.x - startB.x, y: startA.y - startB.y };
  const a = dot(directionA, directionA);
  const e = dot(directionB, directionB);
  const b = dot(directionA, directionB);
  const c = dot(directionA, betweenStarts);
  const f = dot(directionB, betweenStarts);
  const denominator = a * e - b * b;
  let s = denominator > 1e-7 ? clamp01((b * f - c * e) / denominator) : 0;
  const t = clamp01((b * s + f) / e);
  s = clamp01((b * t - c) / a);
  const pointA = { x: startA.x + directionA.x * s, y: startA.y + directionA.y * s };
  const pointB = { x: startB.x + directionB.x * t, y: startB.y + directionB.y * t };
  let dx = pointB.x - pointA.x;
  let dy = pointB.y - pointA.y;
  const distance = Math.hypot(dx, dy);
  const diameter = radius * 2;
  if (distance >= diameter) return null;
  if (distance < 1e-5) {
    dx = centerB.x - centerA.x;
    dy = centerB.y - centerA.y;
  }
  const normalLength = Math.hypot(dx, dy) || 1;
  return {
    normal: { x: dx / normalLength, y: dy / normalLength },
    penetration: diameter - distance,
  };
}

export function resolveEqualMassCollision(
  positionA: Vec2,
  positionB: Vec2,
  velocityA: Vec2,
  velocityB: Vec2,
  restitution = 0.92,
  contactNormal?: Vec2,
): readonly [Vec2, Vec2] {
  const dx = positionB.x - positionA.x;
  const dy = positionB.y - positionA.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) return [velocityA, velocityB];
  const suppliedLength = contactNormal ? Math.hypot(contactNormal.x, contactNormal.y) : 0;
  const nx = contactNormal && suppliedLength > 0 ? contactNormal.x / suppliedLength : dx / distance;
  const ny = contactNormal && suppliedLength > 0 ? contactNormal.y / suppliedLength : dy / distance;
  const relative = (velocityA.x - velocityB.x) * nx + (velocityA.y - velocityB.y) * ny;
  if (relative <= 0) return [velocityA, velocityB];
  const impulseX = nx * relative * restitution;
  const impulseY = ny * relative * restitution;
  return [
    { x: velocityA.x - impulseX, y: velocityA.y - impulseY },
    { x: velocityB.x + impulseX, y: velocityB.y + impulseY },
  ];
}

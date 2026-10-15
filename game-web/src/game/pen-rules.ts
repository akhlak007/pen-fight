export interface Vec2 { readonly x: number; readonly y: number }
export interface CapsuleContact { readonly normal: Vec2; readonly penetration: number }
export type KnockoutOutcome = 0 | 1 | 'draw' | null;

export const TABLE_BOUNDS = Object.freeze({ centerZ: 0.4, halfWidth: 3.9, halfDepth: 6.75 });
export const PLAYER_CORNER = Object.freeze({ x: -2.35, z: 5.05 });
export const AI_CORNER = Object.freeze({ x: 2.35, z: -4.25 });

export function isOutsideTable(x: number, z: number): boolean {
  return Math.abs(x) > TABLE_BOUNDS.halfWidth || Math.abs(z - TABLE_BOUNDS.centerZ) > TABLE_BOUNDS.halfDepth;
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
): readonly [Vec2, Vec2] {
  const dx = positionB.x - positionA.x;
  const dy = positionB.y - positionA.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) return [velocityA, velocityB];
  const nx = dx / distance;
  const ny = dy / distance;
  const relative = (velocityA.x - velocityB.x) * nx + (velocityA.y - velocityB.y) * ny;
  if (relative <= 0) return [velocityA, velocityB];
  const impulseX = nx * relative * restitution;
  const impulseY = ny * relative * restitution;
  return [
    { x: velocityA.x - impulseX, y: velocityA.y - impulseY },
    { x: velocityB.x + impulseX, y: velocityB.y + impulseY },
  ];
}

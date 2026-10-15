export interface Vec2 { readonly x: number; readonly y: number }

export const TABLE_BOUNDS = Object.freeze({ centerZ: 0.4, halfWidth: 3.9, halfDepth: 6.75 });
export const PLAYER_CORNER = Object.freeze({ x: -2.35, z: 5.05 });
export const AI_CORNER = Object.freeze({ x: 2.35, z: -4.25 });

export function isOutsideTable(x: number, z: number): boolean {
  return Math.abs(x) > TABLE_BOUNDS.halfWidth || Math.abs(z - TABLE_BOUNDS.centerZ) > TABLE_BOUNDS.halfDepth;
}

export function knockoutWinner(playerOut: boolean, aiOut: boolean): 0 | 1 | null {
  if (!playerOut && !aiOut) return null;
  return aiOut && !playerOut ? 0 : 1;
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

import * as THREE from 'three';

const DESK_CENTER_Z = 0.4;
const DESK_HALF_WIDTH = 5.75;
const DESK_HALF_DEPTH = 7.45;
const DESK_TOP = 2.55;
const PHONE_MIN_FOV = 40;
const PHONE_MAX_FOV = 96;

export interface ScreenBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export function projectedDeskBounds(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
): ScreenBounds {
  camera.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  const bounds: ScreenBounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (const x of [-DESK_HALF_WIDTH, DESK_HALF_WIDTH]) {
    for (const z of [DESK_CENTER_Z - DESK_HALF_DEPTH, DESK_CENTER_Z + DESK_HALF_DEPTH]) {
      point.set(x, DESK_TOP, z).project(camera);
      const screenX = (point.x + 1) * width * 0.5;
      const screenY = (1 - point.y) * height * 0.5;
      bounds.left = Math.min(bounds.left, screenX);
      bounds.right = Math.max(bounds.right, screenX);
      bounds.top = Math.min(bounds.top, screenY);
      bounds.bottom = Math.max(bounds.bottom, screenY);
    }
  }
  return bounds;
}

/**
 * Frames the complete desk on a portrait phone while leaving touch-safe room
 * for the top controls and bottom power/score dock.
 */
export function framePhoneArena(
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  reversed = false,
): ScreenBounds {
  camera.clearViewOffset();
  camera.aspect = width / height;
  camera.position.set(0, 23.5, reversed ? -5.4 : 6.2);
  camera.lookAt(0, 2.55, DESK_CENTER_Z);

  const sideGutter = Math.max(10, width * 0.025);
  const topGutter = Math.max(56, height * 0.065);
  const bottomGutter = Math.min(112, Math.max(88, height * 0.12));
  let low = PHONE_MIN_FOV;
  let high = PHONE_MAX_FOV;
  for (let pass = 0; pass < 20; pass += 1) {
    const fov = (low + high) * 0.5;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    const bounds = projectedDeskBounds(camera, width, height);
    const fits = bounds.left >= sideGutter
      && bounds.right <= width - sideGutter
      && bounds.top >= topGutter
      && bounds.bottom <= height - bottomGutter;
    if (fits) high = fov;
    else low = fov;
  }
  camera.fov = high;
  camera.updateProjectionMatrix();
  return projectedDeskBounds(camera, width, height);
}

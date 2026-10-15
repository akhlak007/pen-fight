import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createBlackboardTexture, createTileTexture, createWoodTexture } from './textures';

const woodGeometry = new RoundedBoxGeometry(5.8, 0.34, 2.2, 3, 0.1);
const benchGeometry = new RoundedBoxGeometry(5.5, 0.3, 0.78, 3, 0.08);
const legGeometry = new RoundedBoxGeometry(0.18, 2.1, 0.18, 2, 0.04);

function enableShadows(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function createDesk(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const top = new THREE.Mesh(woodGeometry, material);
  top.position.y = 2.25;
  group.add(top);
  const bench = new THREE.Mesh(benchGeometry, material);
  bench.position.set(0, 1.45, 1.75);
  group.add(bench);
  const metal = new THREE.MeshStandardMaterial({ color: '#17130f', metalness: 0.72, roughness: 0.36 });
  for (const x of [-2.3, 2.3]) {
    for (const z of [-0.7, 0.7]) {
      const leg = new THREE.Mesh(legGeometry, metal);
      leg.position.set(x, 1.05, z);
      group.add(leg);
    }
    const benchLeg = new THREE.Mesh(legGeometry, metal);
    benchLeg.position.set(x, 0.72, 1.75);
    group.add(benchLeg);
  }
  enableShadows(group);
  return group;
}

function createPen(color = '#137cd1'): THREE.Group {
  const group = new THREE.Group();
  const barrelMaterial = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.2,
    metalness: 0.06,
    transmission: 0.18,
    transparent: true,
    opacity: 0.94,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 3.35, 18), barrelMaterial);
  barrel.rotation.z = Math.PI / 2;
  group.add(barrel);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.72, 18), new THREE.MeshStandardMaterial({ color: '#e4f3ff', roughness: 0.48 }));
  grip.rotation.z = Math.PI / 2;
  grip.position.x = 1.45;
  group.add(grip);
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 18), new THREE.MeshStandardMaterial({ color: '#d8d9da', metalness: 0.9, roughness: 0.15 }));
  nib.rotation.z = -Math.PI / 2;
  nib.position.x = 2.02;
  group.add(nib);
  const clip = new THREE.Mesh(new RoundedBoxGeometry(1, 0.06, 0.07, 2, 0.025), new THREE.MeshStandardMaterial({ color: '#e6edf2', metalness: 0.72, roughness: 0.2 }));
  clip.position.set(-1.32, 0.14, 0);
  group.add(clip);
  enableShadows(group);
  return group;
}

function createBackpack(color: string): THREE.Group {
  const group = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.25, 1.7, 0.62, 4, 0.25), fabric);
  body.position.y = 0.9;
  group.add(body);
  const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.64, 0.26, 3, 0.16), fabric);
  pocket.position.set(0, 0.63, 0.43);
  group.add(pocket);
  const zip = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 8, 20, Math.PI), new THREE.MeshStandardMaterial({ color: '#a89b7c', metalness: 0.6, roughness: 0.3 }));
  zip.position.set(0, 1.18, 0.54);
  zip.rotation.z = Math.PI;
  group.add(zip);
  enableShadows(group);
  return group;
}

function createNotebook(): THREE.Group {
  const group = new THREE.Group();
  const pages = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.1, 1.15, 2, 0.04), new THREE.MeshStandardMaterial({ color: '#efe8ce', roughness: 0.95 }));
  const cover = new THREE.Mesh(new RoundedBoxGeometry(1.68, 0.035, 1.2, 2, 0.03), new THREE.MeshStandardMaterial({ color: '#d4a335', roughness: 0.78 }));
  cover.position.y = 0.07;
  group.add(pages, cover);
  return group;
}

export interface ClassroomScene {
  readonly group: THREE.Group;
  readonly heroPens: THREE.Group;
  updateBoard(playerName: string): void;
  update(time: number, delta: number, reducedMotion: boolean): void;
  aim(deltaX: number, pull: number): void;
  flick(power: number): void;
  resetPens(): void;
  canGrab(raycaster: THREE.Raycaster): boolean;
  setFallListener(listener: (winner: 0 | 1) => void): void;
}

export function createClassroom(): ClassroomScene {
  const group = new THREE.Group();
  group.name = 'classroom';
  const woodTexture = createWoodTexture();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture, color: '#b76422', roughness: 0.48, metalness: 0.02 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(46, 32), new THREE.MeshStandardMaterial({ map: createTileTexture(), color: '#d5caae', roughness: 0.88 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(46, 15), new THREE.MeshStandardMaterial({ color: '#657151', roughness: 0.95 }));
  backWall.position.set(0, 7.5, -15.5);
  group.add(backWall);

  const deskPositions: readonly [number, number, number][] = [
    [-12, -9, 0.08], [-12, -3.2, 0.08], [-12, 7, 0.08],
    [12, -9, -0.08], [12, -3.2, -0.08], [12, 7, -0.08],
    [-6, 11.4, 0], [6, 11.4, 0],
  ];
  for (const [x, z, rotation] of deskPositions) {
    const desk = createDesk(wood);
    desk.position.set(x, 0, z);
    desk.rotation.y = rotation;
    group.add(desk);
  }

  const arena = createDesk(wood);
  arena.scale.set(1.08, 1, 1.42);
  arena.position.set(0, 0, 1.8);
  group.add(arena);

  const boardFrame = new THREE.Mesh(new RoundedBoxGeometry(12.6, 6.2, 0.42, 3, 0.12), wood);
  boardFrame.position.set(0, 7.3, -15.05);
  group.add(boardFrame);
  const boardMaterial = new THREE.MeshStandardMaterial({ map: createBlackboardTexture(''), roughness: 0.96 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(11.85, 5.45), boardMaterial);
  board.position.set(0, 7.3, -14.81);
  group.add(board);

  const notebooks = createNotebook();
  notebooks.position.set(-11.1, 2.5, -3.4);
  notebooks.rotation.y = 0.18;
  group.add(notebooks);
  const bagBlue = createBackpack('#162d55');
  bagBlue.position.set(8.1, 0, -10.7);
  bagBlue.rotation.y = -0.22;
  group.add(bagBlue);
  const bagRed = createBackpack('#611f27');
  bagRed.position.set(9.3, 0, 3.8);
  bagRed.rotation.y = 0.34;
  group.add(bagRed);

  const heroPens = new THREE.Group();
  heroPens.name = 'hero-pens';
  const blue = createPen('#128de0');
  blue.rotation.y = -0.35;
  blue.position.set(-0.35, 2.56, 1.8);
  const red = createPen('#d53c31');
  red.rotation.y = 1.15;
  red.position.set(0.65, 2.58, 1.6);
  heroPens.add(blue, red);
  group.add(heroPens);

  const blueStart = blue.position.clone();
  const redStart = red.position.clone();
  const blueVelocity = new THREE.Vector2();
  const redVelocity = new THREE.Vector2();
  let aimOffset = 0;
  let fallListener: (winner: 0 | 1) => void = () => undefined;

  return {
    group,
    heroPens,
    updateBoard(playerName: string) {
      const previous = boardMaterial.map;
      boardMaterial.map = createBlackboardTexture(playerName);
      boardMaterial.needsUpdate = true;
      previous?.dispose();
    },
    update(time: number, delta: number, reducedMotion: boolean) {
      if (!reducedMotion) bagBlue.rotation.z = Math.sin(time * 0.00035) * 0.008;
      for (const [pen, velocity] of [[blue, blueVelocity], [red, redVelocity]] as const) {
        pen.position.x += velocity.x * delta;
        pen.position.z += velocity.y * delta;
        velocity.multiplyScalar(Math.exp(-1.55 * delta));
        pen.rotation.y += velocity.length() * delta * 0.8;
      }
      if (blue.position.distanceTo(red.position) < 0.72 && blueVelocity.length() > 1.1) {
        redVelocity.add(blueVelocity.clone().multiplyScalar(0.72));
        blueVelocity.multiplyScalar(0.28);
      }
      const blueOut = Math.abs(blue.position.x) > 3.2 || Math.abs(blue.position.z - 1.8) > 2.2;
      const redOut = Math.abs(red.position.x) > 3.2 || Math.abs(red.position.z - 1.8) > 2.2;
      if (blueOut || redOut) {
        fallListener(redOut && !blueOut ? 0 : 1);
        blue.position.copy(blueStart);
        red.position.copy(redStart);
        blueVelocity.set(0, 0);
        redVelocity.set(0, 0);
      }
    },
    aim(deltaX: number, pull: number) {
      aimOffset = THREE.MathUtils.clamp(deltaX * 0.006, -0.75, 0.75);
      blue.rotation.y = -0.35 + aimOffset;
      blue.position.z = blueStart.z + THREE.MathUtils.clamp(pull * 0.006, 0, 0.7);
    },
    flick(power: number) {
      const strength = THREE.MathUtils.clamp(power * 55, 3.4, 12.5);
      blueVelocity.set(Math.cos(aimOffset) * strength, -Math.sin(aimOffset) * strength);
      blue.position.z = blueStart.z;
    },
    resetPens() {
      blue.position.copy(blueStart); red.position.copy(redStart);
      blueVelocity.set(0, 0); redVelocity.set(0, 0);
    },
    canGrab(raycaster: THREE.Raycaster) {
      return raycaster.intersectObject(blue, true).length > 0;
    },
    setFallListener(listener: (winner: 0 | 1) => void) {
      fallListener = listener;
    },
  };
}

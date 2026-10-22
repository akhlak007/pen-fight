import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MatchMode } from '../app/app-state';
import type { ArenaSnapshot } from '../network/protocol';
import { DeskWorld, DESK_TOP, impulseMagnitude, PEN_HALF_LENGTH, PEN_RADIUS, powerForImpulse, startDeskWorld } from '../game/desk-physics';
import { type ArenaAction, SoloTurnController } from '../game/solo-turn-controller';
import {
  AI_CORNER,
  assistedDirection,
  capsuleContact,
  axialShotEfficiency,
  computeFlickAim,
  grabSpinShare,
  knockoutWinner,
  spinFromGrab,
  penHasFallen,
  PLAYER_CORNER,
  resolveEqualMassCollision,
} from '../game/pen-rules';
import { createBlackboardTexture, createTileTexture, createWoodTexture } from './textures';
import { deskById, penById } from '../profile/profile-catalog';
import { STANDARD_ARENA, aiImpulseForDistance, safeAiShotAngle, validateChallenge, type ArenaChallenge } from '../game/arena-challenges';

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
  const penVisual = new THREE.Group();
  penVisual.scale.setScalar(0.75);

  const barrelMaterial = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.2,
    metalness: 0.06,
    transmission: 0,
    transparent: false,
    opacity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 3.35, 18), barrelMaterial);
  barrel.name = 'pen-cosmetic-barrel';
  barrel.rotation.z = Math.PI / 2;
  penVisual.add(barrel);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.72, 18), new THREE.MeshStandardMaterial({ color: '#e4f3ff', roughness: 0.48 }));
  grip.name = 'pen-cosmetic-grip';
  grip.rotation.z = Math.PI / 2;
  grip.position.x = 1.45;
  penVisual.add(grip);
  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 18), new THREE.MeshStandardMaterial({ color: '#d8d9da', metalness: 0.9, roughness: 0.15 }));
  nib.rotation.z = -Math.PI / 2;
  nib.position.x = 2.02;
  penVisual.add(nib);
  const clip = new THREE.Mesh(new RoundedBoxGeometry(1, 0.06, 0.07, 2, 0.025), new THREE.MeshStandardMaterial({ color: '#e6edf2', metalness: 0.72, roughness: 0.2 }));
  clip.position.set(-1.32, 0.14, 0);
  penVisual.add(clip);
  enableShadows(penVisual);
  group.add(penVisual);

  const hitTarget = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 1.8, 2.8),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  );
  hitTarget.name = 'pen-pickup-target';
  group.add(hitTarget);
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

function createPencilBox(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.85, 0.34, 0.62, 3, 0.09), new THREE.MeshStandardMaterial({ color: '#d99018', roughness: 0.64 }));
  const label = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.025, 0.36, 2, 0.025), new THREE.MeshStandardMaterial({ color: '#263e72', roughness: 0.72 }));
  label.position.y = 0.19;
  group.add(body, label);
  enableShadows(group);
  return group;
}

function createLoosePaper(): THREE.Group {
  const group = new THREE.Group();
  const paper = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.055, 1.45, 2, 0.025), new THREE.MeshStandardMaterial({ color: '#eee9d8', roughness: 0.92 }));
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.65, 8), new THREE.MeshStandardMaterial({ color: '#bd2d24', roughness: 0.54 }));
  pencil.rotation.z = Math.PI / 2;
  pencil.position.set(0.15, 0.11, 0.08);
  group.add(paper, pencil);
  enableShadows(group);
  return group;
}

const DIGIT_SEGMENTS: Readonly<Record<number, readonly string[]>> = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'c', 'd', 'g'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g'],
};

function createLevelBadge(level: number, accent: string, theme: string): THREE.Group {
  const badge = new THREE.Group();
  badge.name = 'arena-level-badge';
  badge.userData.level = level;
  badge.userData.theme = theme;
  const material = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.84, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.02, 48), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  badge.add(ring);
  const segmentLayouts: Readonly<Record<string, readonly [number, number, number, number]>> = {
    a: [0, -0.48, 0.4, 0.075],
    b: [0.235, -0.245, 0.075, 0.38],
    c: [0.235, 0.245, 0.075, 0.38],
    d: [0, 0.48, 0.4, 0.075],
    e: [-0.235, 0.245, 0.075, 0.38],
    f: [-0.235, -0.245, 0.075, 0.38],
    g: [0, 0, 0.4, 0.075],
  };
  const digits = [Math.floor(level / 10), level % 10];
  digits.forEach((digit, digitIndex) => {
    const digitX = digitIndex === 0 ? -0.34 : 0.34;
    for (const segment of DIGIT_SEGMENTS[digit] ?? []) {
      const layout = segmentLayouts[segment];
      if (!layout) continue;
      const [x, z, width, depth] = layout;
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(digitX + x, 0.006, z);
      badge.add(bar);
    }
  });
  return badge;
}

function createArenaTable(material: THREE.Material, challenge: ArenaChallenge = STANDARD_ARENA): THREE.Group {
  const group = new THREE.Group();
  const legacyStandard = challenge.hazard === 'standard';
  const topWidth = legacyStandard ? 11.8 : challenge.halfWidth * 2;
  const topDepth = legacyStandard ? 14.8 : challenge.halfDepth * 2;
  const apronWidth = legacyStandard ? 11.2 : challenge.halfWidth * 2 - 0.6;
  const apronZ = legacyStandard ? 7.15 : challenge.halfDepth - 0.3;
  const sideDepth = legacyStandard ? 14.1 : challenge.halfDepth * 2 - 0.8;
  const sideX = legacyStandard ? 5.65 : challenge.halfWidth - 0.1;
  const legX = legacyStandard ? 4.85 : challenge.halfWidth - 0.9;
  const legZ = legacyStandard ? 5.9 : challenge.halfDepth - 1.55;
  const crossbarWidth = legacyStandard ? 9.8 : challenge.halfWidth * 2 - 1.7;
  const top = new THREE.Mesh(new RoundedBoxGeometry(topWidth, 0.46, topDepth, 5, 0.16), material);
  top.name = 'arena-table-top';
  top.position.y = 2.32;
  group.add(top);
  if (!legacyStandard) {
    const tintMaterial = new THREE.MeshBasicMaterial({
      color: challenge.visual.tint,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const tint = new THREE.Mesh(new THREE.PlaneGeometry(topWidth - 0.25, topDepth - 0.25), tintMaterial);
    tint.name = 'arena-level-tint';
    tint.userData.theme = challenge.visual.key;
    tint.rotation.x = -Math.PI / 2;
    tint.position.y = 2.553;
    group.add(tint);
    const badge = createLevelBadge(challenge.level, challenge.visual.accent, challenge.visual.key);
    badge.position.set(0, 2.568, 0);
    group.add(badge);
  }
  const apronMaterial = new THREE.MeshStandardMaterial({ color: '#4b2c18', roughness: 0.62, metalness: 0.03 });
  const frontApron = new THREE.Mesh(new RoundedBoxGeometry(apronWidth, 0.55, 0.2, 3, 0.05), apronMaterial);
  frontApron.position.set(0, 2.02, apronZ);
  const backApron = frontApron.clone();
  backApron.position.z = -apronZ;
  const sideApron = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.55, sideDepth, 3, 0.05), apronMaterial);
  sideApron.position.set(sideX, 2.02, 0);
  const otherSideApron = sideApron.clone();
  otherSideApron.position.x = -sideX;
  group.add(frontApron, backApron, sideApron, otherSideApron);

  const metal = new THREE.MeshStandardMaterial({ color: '#17191a', metalness: 0.8, roughness: 0.27 });
  for (const x of [-legX, legX]) {
    for (const z of [-legZ, legZ]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.27, 2.2, 0.27, 2, 0.05), metal);
      leg.position.set(x, 1.08, z);
      group.add(leg);
    }
  }
  const crossbar = new THREE.Mesh(new RoundedBoxGeometry(crossbarWidth, 0.16, 0.16, 2, 0.04), metal);
  crossbar.position.set(0, 0.72, 0);
  group.add(crossbar);

  const marking = new THREE.MeshStandardMaterial({ color: '#f1dfad', roughness: 0.82, transparent: true, opacity: 0.72 });
  const accent = new THREE.MeshStandardMaterial({ color: '#ca512b', roughness: 0.78, transparent: true, opacity: 0.82 });
  const addStrip = (width: number, depth: number, x: number, z: number, stripMaterial = marking) => {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), stripMaterial);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(x, 2.558, z);
    group.add(strip);
  };
  addStrip(0.055, challenge.halfDepth * 2 - 1.1, 0, 0, accent);
  addStrip(challenge.halfWidth * 2 - 0.4, 0.045, 0, 0, marking);
  addStrip(challenge.halfWidth * 2 - 0.4, 0.045, 0, -(challenge.halfDepth - 0.6), marking);
  addStrip(challenge.halfWidth * 2 - 0.4, 0.045, 0, challenge.halfDepth - 0.6, marking);
  addStrip(0.045, challenge.halfDepth * 2 - 1.15, -(challenge.halfWidth - 0.2), 0, marking);
  addStrip(0.045, challenge.halfDepth * 2 - 1.15, challenge.halfWidth - 0.2, 0, marking);

  const startZones = challenge.hazard === 'standard'
    ? [{ x: -4.6, z: 6 }, { x: 4.6, z: -6 }]
    : challenge.spawns.map((spawn) => ({ x: spawn.x, z: spawn.z - challenge.centerZ }));
  startZones.forEach((spawn, index) => {
    const zone = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.53, 48), accent);
    zone.name = `arena-start-zone:${index}`;
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(spawn.x, 2.562, spawn.z);
    group.add(zone);
  });
  const slickMaterial = new THREE.MeshStandardMaterial({ color: '#69d3e5', roughness: 0.15, transparent: true, opacity: 0.34 });
  for (const zone of challenge.frictionZones) {
    const patch = new THREE.Mesh(new RoundedBoxGeometry(zone.halfWidth * 2, 0.025, zone.halfDepth * 2, 4, 0.18), slickMaterial);
    patch.name = `arena-friction:${zone.id}`;
    patch.position.set(zone.x, DESK_TOP + 0.014, zone.z - challenge.centerZ);
    group.add(patch);
  }
  for (const obstacle of challenge.obstacles) {
    const obstacleMaterial = new THREE.MeshStandardMaterial({
      color: obstacle.kind === 'ruler' ? '#e1b735' : obstacle.kind === 'chalk' ? '#e8e0cf' : '#b64b32',
      roughness: obstacle.kind === 'chalk' ? 0.9 : 0.58,
    });
    const mesh = obstacle.kind === 'bumper'
      ? new THREE.Mesh(new THREE.CylinderGeometry(obstacle.halfWidth, obstacle.halfWidth, obstacle.height, 24), obstacleMaterial)
      : new THREE.Mesh(new RoundedBoxGeometry(obstacle.halfWidth * 2, obstacle.height, obstacle.halfDepth * 2, 3, Math.min(0.08, obstacle.halfDepth * 0.25)), obstacleMaterial);
    mesh.name = `arena-obstacle:${obstacle.id}`;
    mesh.position.set(obstacle.x, DESK_TOP + obstacle.height / 2, obstacle.z - challenge.centerZ);
    mesh.rotation.y = obstacle.rotation;
    group.add(mesh);
  }
  enableShadows(group);
  return group;
}

export interface ClassroomScene {
  readonly group: THREE.Group;
  readonly heroPens: THREE.Group;
  readonly activePlayer: number;
  updateBoard(playerName: string, opponentName?: string, score?: readonly number[]): void;
  update(time: number, delta: number, reducedMotion: boolean): void;
  aim(deltaX: number, deltaY: number, grabShare?: number): boolean;
  flick(): boolean;
  grabShare(raycaster: THREE.Raycaster): number;
  cancelAim(): void;
  resetPens(): void;
  canGrab(raycaster: THREE.Raycaster): boolean;
  setFallListener(listener: (winner: number) => void): void;
  setTurnListener(listener: (player: number) => void): void;
  setAimListener(listener: (power: number) => void): void;
  setRoundListener(listener: (message: string | null) => void): void;
  setActionListener(listener: (action: ArenaAction) => void): void;
  setHitListener(listener: (intensity: number) => void): void;
  setMatchMode(mode: MatchMode, playerCount?: number, playerNames?: readonly string[], challenge?: ArenaChallenge): void;
  getArenaSnapshot(seq: number, score: readonly number[]): ArenaSnapshot;
  applyArenaSnapshot(snapshot: ArenaSnapshot): void;
  setReplica(value: boolean): void;
  setCosmetics(penIds: readonly (string | undefined)[], deskId: string): void;
  isPenMoving(): boolean;
  readonly ready: Promise<void>;
}

export function createClassroom(
  startPhysics: () => Promise<DeskWorld> = startDeskWorld,
): ClassroomScene {
  const group = new THREE.Group();
  let replica = false;
  const r3 = (v: number) => Math.round(v * 1000) / 1000;
  const replicaTargets = [
    { x: 0, y: 2.62, z: 0, rotX: 0, angle: 0, rotZ: 0, vx: 0, vz: 0, av: 0, active: false },
    { x: 0, y: 2.63, z: 0, rotX: 0, angle: 0, rotZ: 0, vx: 0, vz: 0, av: 0, active: false },
  ];
  group.name = 'classroom';
  const woodTexture = createWoodTexture();
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture, color: '#c2b18d', roughness: 0.56, metalness: 0.01 });
  const arenaWood = new THREE.MeshStandardMaterial({ map: woodTexture.clone(), color: '#e6c995', roughness: 0.48, metalness: 0.01 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(52, 38), new THREE.MeshStandardMaterial({ map: createTileTexture(), color: '#afa98f', roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(64, 15), new THREE.MeshStandardMaterial({ color: '#596348', roughness: 0.95 }));
  backWall.position.set(0, 7.5, -15.5);
  group.add(backWall);

  const deskPositions: readonly [number, number, number][] = [
    [-12.5, -6.7, 0.03], [-12.5, 0.2, 0.03], [-12.5, 7.5, 0.03],
    [12.5, -6.7, -0.03], [12.5, 0.2, -0.03], [12.5, 7.5, -0.03],
    [-10.2, -12.2, 0], [10.2, -12.2, 0], [-10.5, 14.1, 0], [10.5, 14.1, 0],
  ];
  for (const [x, z, rotation] of deskPositions) {
    const desk = createDesk(wood);
    desk.position.set(x, 0, z);
    desk.rotation.y = rotation;
    if (z < -10) {
      desk.scale.set(1.85, 3.35, 1.85);
    } else {
      desk.scale.setScalar(1.72);
    }
    group.add(desk);
  }

  let activeChallenge = STANDARD_ARENA;
  let arena = createArenaTable(arenaWood, activeChallenge);
  arena.position.set(0, 0, 0.4);
  group.add(arena);

  const boardFrame = new THREE.Mesh(new RoundedBoxGeometry(13.8, 5.8, 0.48, 3, 0.12), wood);
  boardFrame.position.set(0, 5.6, -15.05);
  group.add(boardFrame);
  const boardMaterial = new THREE.MeshStandardMaterial({ map: createBlackboardTexture(''), roughness: 0.96 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(13.05, 5.05), boardMaterial);
  board.position.set(0, 5.6, -14.79);
  group.add(board);

  const chalkTray = new THREE.Mesh(new RoundedBoxGeometry(7.2, 0.18, 0.5, 2, 0.05), wood);
  chalkTray.position.set(0, 2.55, -14.55);
  group.add(chalkTray);

  const notebooks = createNotebook();
  notebooks.position.set(-10.7, 2.5, -11.8);
  notebooks.rotation.y = 0.18;
  group.add(notebooks);
  const pencilBox = createPencilBox();
  pencilBox.position.set(-11.7, 2.55, -11.7);
  pencilBox.rotation.y = -0.16;
  group.add(pencilBox);
  const paper = createLoosePaper();
  paper.position.set(10.6, 2.53, -11.7);
  paper.rotation.y = 0.14;
  group.add(paper);
  const bagBlue = createBackpack('#182e55');
  bagBlue.scale.setScalar(1.35);
  bagBlue.position.set(7.8, 0, -10.1);
  bagBlue.rotation.y = -0.22;
  group.add(bagBlue);
  const bagRed = createBackpack('#611f27');
  bagRed.scale.setScalar(1.35);
  bagRed.position.set(9.4, 0, 2.9);
  bagRed.rotation.y = 0.34;
  group.add(bagRed);

  const PEN_COLORS = ['#128de0', '#d94f35', '#1ea857', '#e69f00'] as const;
  const heroPens = new THREE.Group();
  heroPens.name = 'hero-pens';
  const blue = createPen(PEN_COLORS[0]);
  const red = createPen(PEN_COLORS[1]);
  const green = createPen(PEN_COLORS[2]);
  const gold = createPen(PEN_COLORS[3]);
  const pens: readonly [THREE.Group, THREE.Group, THREE.Group, THREE.Group] = [blue, red, green, gold];
  const defaultPenIds = ['classic-blue', 'red-comet', 'mint-strike', 'sunset-orange'] as const;
  blue.rotation.y = 1.08;
  blue.position.set(PLAYER_CORNER.x, 2.62, PLAYER_CORNER.z);
  red.rotation.y = -2.05;
  red.position.set(AI_CORNER.x, 2.62, AI_CORNER.z);
  green.rotation.y = -1.08;
  green.position.set(-2.8, 2.62, -4.0);
  gold.rotation.y = 2.05;
  gold.position.set(2.8, 2.62, 4.6);
  green.visible = false;
  gold.visible = false;
  heroPens.add(...pens);
  group.add(heroPens);

  const blueVelocity = new THREE.Vector2();
  const redVelocity = new THREE.Vector2();
  const greenVelocity = new THREE.Vector2();
  const goldVelocity = new THREE.Vector2();
  const penVelocities: readonly [THREE.Vector2, THREE.Vector2, THREE.Vector2, THREE.Vector2] = [
    blueVelocity, redVelocity, greenVelocity, goldVelocity
  ];
  const penAngularVelocities = [0, 0, 0, 0];
  const penWobbles = [0, 0, 0, 0];
  let activePlayerCount = 2;
  let currentMatchPlayerNames: readonly string[] = ['Player 1', 'Player 2'];

  const turns = new SoloTurnController();
  let matchMode: MatchMode = 'quick';
  let shotAngle = 1.08;
  let aimPower = 0;
  let shotSpin = 0;
  let shotStrike = 0;
  let shotEfficiency = 1;
  let shotShaped = false;
  let desk: DeskWorld | null = null;
  let pendingDesk: DeskWorld | null = null;
  const replaceArenaVisual = (challenge: ArenaChallenge) => {
    group.remove(arena);
    arena.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) if (material !== arenaWood) material.dispose();
    });
    arena = createArenaTable(arenaWood, challenge);
    arena.position.set(0, 0, challenge.centerZ);
    group.add(arena);
  };
  const configureDeskSafely = (world: DeskWorld, challenge: ArenaChallenge): ArenaChallenge => {
    try {
      world.configure(challenge);
      return challenge;
    } catch (error: unknown) {
      console.error(`Arena "${challenge.name}" failed to configure; restoring the classic desk.`, error);
      try {
        world.configure(STANDARD_ARENA);
      } catch (fallbackError: unknown) {
        console.error('Classic desk fallback failed to configure.', fallbackError);
      }
      return STANDARD_ARENA;
    }
  };
  const applyChallenge = (requested?: ArenaChallenge) => {
    let next = requested ?? STANDARD_ARENA;
    const validation = validateChallenge(next);
    if (!validation.valid) {
      console.warn(`Arena "${next.name}" is invalid (${validation.reason}); using the classic desk.`);
      next = STANDARD_ARENA;
    }
    if (desk) next = configureDeskSafely(desk, next);
    activeChallenge = next;
    replaceArenaVisual(activeChallenge);
  };
  const activatePendingDesk = () => {
    if (desk || !pendingDesk) return;
    desk = pendingDesk;
    pendingDesk = null;
    const configured = configureDeskSafely(desk, activeChallenge);
    if (configured !== activeChallenge) {
      activeChallenge = configured;
      replaceArenaVisual(activeChallenge);
    }
    desk.sync(pens, activePlayerCount);
    desk.sleepPens();
  };
  const ready = startPhysics().then((world) => {
    pendingDesk = world;
    if (turns.phase === 'player' && !aimActive && !falling) activatePendingDesk();
  }).catch((error: unknown) => {
    console.error('Desk physics failed to start', error);
  });
  const aimOrigin = blue.position.clone();
  let aimOriginAngle = blue.rotation.y;
  let aimActive = false;
  let fallListener: (winner: number) => void = () => undefined;
  let turnListener: (player: number) => void = () => undefined;
  let aimListener: (power: number) => void = () => undefined;
  let roundListener: (message: string | null) => void = () => undefined;
  let actionListener: (action: ArenaAction) => void = () => undefined;
  let falling: {
    pens: readonly THREE.Group[];
    winner: number | null;
    elapsed: number;
    scored: boolean;
  } | null = null;

  const aimGeometry = new THREE.BufferGeometry();
  const aimLine = new THREE.Line(
    aimGeometry,
    new THREE.LineBasicMaterial({ color: '#f5d34f', transparent: true, opacity: 0.92 }),
  );
  aimLine.visible = false;
  const aimHead = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.46, 16),
    new THREE.MeshBasicMaterial({ color: '#ffe66d', transparent: true, opacity: 0.95 }),
  );
  aimHead.visible = false;
  group.add(aimLine, aimHead);

  const aimDots: THREE.Mesh[] = [];
  const aimDotGeom = new THREE.SphereGeometry(0.095, 12, 12);
  const aimDotMat = new THREE.MeshBasicMaterial({
    color: '#ffe66d',
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  for (let i = 0; i < 5; i++) {
    const dotMesh = new THREE.Mesh(aimDotGeom, aimDotMat);
    dotMesh.visible = false;
    group.add(dotMesh);
    aimDots.push(dotMesh);
  }

  const targetRingMaterial = new THREE.MeshBasicMaterial({
    color: '#ff3b5c',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.64, 32), targetRingMaterial);
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.y = 2.569;
  targetRing.visible = false;
  group.add(targetRing);

  const turnRingMaterial = new THREE.MeshBasicMaterial({
    color: '#37aaff',
    transparent: true,
    opacity: 0.74,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const turnRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.43, 48), turnRingMaterial);
  turnRing.rotation.x = -Math.PI / 2;
  turnRing.position.y = 2.568;
  group.add(turnRing);

  const shockwaveGeometry = new THREE.RingGeometry(0.12, 0.42, 36);
  const shockwaveMaterial = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
  shockwave.rotation.x = -Math.PI / 2;
  shockwave.visible = false;
  group.add(shockwave);
  let shockwaveTimer = 0;

  const starShape = new THREE.Shape();
  const starPoints = 4;
  for (let i = 0; i < starPoints * 2; i++) {
    const angle = (i * Math.PI) / starPoints;
    const radius = i % 2 === 0 ? 0.95 : 0.22;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (i === 0) starShape.moveTo(px, py);
    else starShape.lineTo(px, py);
  }
  starShape.closePath();
  const starGeometry = new THREE.ShapeGeometry(starShape);
  const starMaterial = new THREE.MeshBasicMaterial({
    color: '#fff375',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const impactStar = new THREE.Mesh(starGeometry, starMaterial);
  impactStar.rotation.x = -Math.PI / 2;
  impactStar.visible = false;
  group.add(impactStar);
  let starTimer = 0;

  interface SparkParticle {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    rotSpeed: THREE.Vector3;
    life: number;
    maxLife: number;
    baseScale: number;
    active: boolean;
  }
  const sparkColors = ['#ffffff', '#fff799', '#ffaa44', '#70c9ff', '#ff5533'];
  const sparkBoxGeom = new THREE.BoxGeometry(0.11, 0.11, 0.11);
  const sparkGroup = new THREE.Group();
  group.add(sparkGroup);
  const sparks: SparkParticle[] = [];
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: sparkColors[i % sparkColors.length],
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(sparkBoxGeom, mat);
    mesh.visible = false;
    sparkGroup.add(mesh);
    sparks.push({
      mesh,
      velocity: new THREE.Vector3(),
      rotSpeed: new THREE.Vector3(),
      life: 0,
      maxLife: 0.38,
      baseScale: 0.8 + Math.random() * 0.6,
      active: false,
    });
  }

  function spawnHitSparks(contactX: number, contactZ: number, normal: THREE.Vector2, intensity: number) {
    const burstSpeed = THREE.MathUtils.clamp(intensity * 1.8, 4.5, 12);
    for (const spark of sparks) {
      spark.mesh.position.set(
        contactX + (Math.random() - 0.5) * 0.2,
        2.62,
        contactZ + (Math.random() - 0.5) * 0.2,
      );
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.4 + Math.random() * 0.8) * burstSpeed;
      spark.velocity.set(
        Math.cos(angle) * speed + normal.x * (burstSpeed * 0.35),
        2.5 + Math.random() * 4.2,
        Math.sin(angle) * speed + normal.y * (burstSpeed * 0.35),
      );
      spark.rotSpeed.set(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22,
      );
      spark.life = spark.maxLife = 0.28 + Math.random() * 0.18;
      spark.active = true;
      spark.mesh.visible = true;
      spark.mesh.scale.setScalar(spark.baseScale);
      (spark.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
    }
  }

  let sharedAudioContext: AudioContext | null = null;
  function playPenClackSound(intensity: number) {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!sharedAudioContext) sharedAudioContext = new AudioCtx();
      if (sharedAudioContext.state === 'suspended') void sharedAudioContext.resume();
      const ctx = sharedAudioContext;
      const now = ctx.currentTime;
      const vol = Math.min(1.0, Math.max(0.18, intensity / 7));

      const bufferSize = Math.floor(ctx.sampleRate * 0.032);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(2600, now);
      bandpass.Q.setValueAtTime(4.0, now);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(vol * 0.9, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
      noiseSource.connect(bandpass);
      bandpass.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start(now);

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(860, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.045);
      oscGain.gain.setValueAtTime(vol * 0.55, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Graceful fallback for audio restrictions
    }
  }

  let hitListener: (intensity: number) => void = () => undefined;

  const START_LAYOUTS_2P: readonly {
    blue: { x: number; z: number; angle: number };
    red: { x: number; z: number; angle: number };
  }[] = [
    { blue: { x: -2.2, z: 4.7, angle: 1.08 }, red: { x: 2.2, z: -3.9, angle: -2.05 } },
    { blue: { x: 2.2, z: 4.8, angle: 2.05 }, red: { x: -2.2, z: -4.0, angle: -1.08 } },
    { blue: { x: -0.8, z: 5.1, angle: 1.57 }, red: { x: 0.8, z: -4.5, angle: -1.57 } },
    { blue: { x: -3.4, z: 4.2, angle: 0.92 }, red: { x: 3.4, z: -3.6, angle: -2.22 } },
    { blue: { x: 1.6, z: 4.5, angle: 1.75 }, red: { x: -1.4, z: -4.6, angle: -1.38 } },
  ];

  const START_LAYOUTS_4P: readonly { x: number; z: number; angle: number }[][] = [
    [
      { x: -2.8, z: 4.6, angle: 1.08 },
      { x: 2.8, z: -4.0, angle: -2.05 },
      { x: -2.8, z: -4.0, angle: -1.08 },
      { x: 2.8, z: 4.6, angle: 2.05 },
    ],
    [
      { x: 0, z: 5.1, angle: 1.57 },
      { x: 0, z: -4.5, angle: -1.57 },
      { x: -3.8, z: 0.4, angle: 0 },
      { x: 3.8, z: 0.4, angle: 3.14 },
    ],
    [
      { x: -3.2, z: 4.2, angle: 0.92 },
      { x: 3.2, z: -3.6, angle: -2.22 },
      { x: -1.8, z: -4.6, angle: -1.38 },
      { x: 1.8, z: 4.5, angle: 1.75 },
    ],
  ];

  let roundIndex = 0;
  let currentServer = 0;

  function resetPenPositions(varied = true): void {
    replicaTargets[0]!.active = false;
    replicaTargets[1]!.active = false;
    if (activePlayerCount === 2) {
      const challengeLayout = matchMode === 'quick'
        ? { blue: activeChallenge.spawns[0], red: activeChallenge.spawns[1] }
        : null;
      const layout = challengeLayout ?? (((!varied || matchMode === 'practice')
        ? START_LAYOUTS_2P[0]
        : START_LAYOUTS_2P[roundIndex % START_LAYOUTS_2P.length]) ?? START_LAYOUTS_2P[0]!);

      blue.position.set(layout.blue.x, 2.62, layout.blue.z);
      red.position.set(layout.red.x, 2.62, layout.red.z);
      blue.rotation.set(0, layout.blue.angle, 0);
      red.rotation.set(0, layout.red.angle, 0);
      blue.visible = true;
      red.visible = true;
      green.visible = false;
      gold.visible = false;
    } else {
      const layout = START_LAYOUTS_4P[roundIndex % START_LAYOUTS_4P.length] ?? START_LAYOUTS_4P[0]!;
      for (let i = 0; i < pens.length; i++) {
        const pen = pens[i];
        if (!pen) continue;
        if (i < activePlayerCount) {
          const cfg = layout[i];
          if (cfg) {
            pen.position.set(cfg.x, 2.62, cfg.z);
            pen.rotation.set(0, cfg.angle, 0);
          }
          pen.visible = true;
        } else {
          pen.visible = false;
        }
      }
    }

    for (let i = 0; i < pens.length; i++) {
      penVelocities[i]?.set(0, 0);
      penAngularVelocities[i] = 0;
      penWobbles[i] = 0;
    }

    aimPower = 0;
    const currentActivePen = activeHumanPen();
    aimOrigin.copy(currentActivePen.position);
    aimOriginAngle = currentActivePen.rotation.y;
    aimActive = false;
    aimListener(0);
    aimLine.visible = false;
    aimHead.visible = false;
    for (const dot of aimDots) dot.visible = false;
    targetRing.visible = false;
    shockwave.visible = false;
    shockwaveTimer = 0;
    impactStar.visible = false;
    starTimer = 0;
    for (const s of sparks) { s.active = false; s.mesh.visible = false; }
    activatePendingDesk();
    desk?.sync(pens, activePlayerCount);
    desk?.sleepPens();
  }

  function launchAi(time: number): void {
    const dx = blue.position.x - red.position.x;
    const dz = blue.position.z - red.position.z;
    const error = Math.sin(time * 0.0037) * activeChallenge.ai.aimError;
    const safeAngle = safeAiShotAngle(activeChallenge, red.position, blue.position, error);
    const angle = safeAngle ?? Math.atan2(-(activeChallenge.centerZ - red.position.z), -red.position.x);
    const distance = Math.hypot(dx, dz);
    const strength = aiImpulseForDistance(activeChallenge, distance);
    red.rotation.y = angle;
    if (desk) {
      desk.syncPen(1, red);
      desk.strike(1, safeAngle === null ? 0 : THREE.MathUtils.clamp(error * 4, -0.85, 0.85), Math.cos(angle), -Math.sin(angle), powerForImpulse(strength, 1));
    } else {
      redVelocity.set(Math.cos(angle) * strength, -Math.sin(angle) * strength);
      penAngularVelocities[1] = error * 1.8;
    }
    actionListener('aiMoving');
    turnListener(1);
  }

  function activeHumanPen(): THREE.Group {
    return pens[turns.activePlayer] ?? blue;
  }

  function inactiveHumanPen(): THREE.Group {
    const currentActive = activeHumanPen();
    let bestDist = Infinity;
    let target: THREE.Group = pens[(turns.activePlayer + 1) % activePlayerCount] ?? red;
    for (let i = 0; i < activePlayerCount; i++) {
      if (i === turns.activePlayer || turns.isEliminated(i)) continue;
      const pen = pens[i];
      if (!pen) continue;
      const d = currentActive.position.distanceTo(pen.position);
      if (d < bestDist) {
        bestDist = d;
        target = pen;
      }
    }
    return target;
  }

  function activeHumanVelocity(): THREE.Vector2 {
    return penVelocities[turns.activePlayer] ?? blueVelocity;
  }

  return {
    group,
    heroPens,
    get activePlayer(): number { return turns.activePlayer; },
    updateBoard(playerName: string, opponentName = 'AI rival', score: readonly number[] = [0, 0]) {
      const previous = boardMaterial.map;
      boardMaterial.map = createBlackboardTexture(playerName, opponentName, [score[0] ?? 0, score[1] ?? 0]);
      boardMaterial.needsUpdate = true;
      previous?.dispose();
    },
    update(time: number, delta: number, reducedMotion: boolean) {
      if (!reducedMotion) bagBlue.rotation.z = Math.sin(time * 0.00035) * 0.008;
      if (replica) {
        const lerpFactor = Math.min(1, delta * 24);
        for (let i = 0; i < 2; i++) {
          const pen = pens[i];
          const target = replicaTargets[i];
          if (!pen || !target || !target.active) continue;

          // Dead reckoning forward using target velocity
          target.x += target.vx * delta;
          target.z += target.vz * delta;
          target.vx *= Math.exp(-2.05 * delta);
          target.vz *= Math.exp(-2.05 * delta);
          target.angle += target.av * delta;
          target.av *= Math.exp(-2.35 * delta);

          // Smooth interpolation
          pen.position.x += (target.x - pen.position.x) * lerpFactor;
          pen.position.y += (target.y - pen.position.y) * lerpFactor;
          pen.position.z += (target.z - pen.position.z) * lerpFactor;

          pen.rotation.x += (target.rotX - pen.rotation.x) * lerpFactor;
          let dAngle = (target.angle - pen.rotation.y) % (Math.PI * 2);
          if (dAngle > Math.PI) dAngle -= Math.PI * 2;
          if (dAngle < -Math.PI) dAngle += Math.PI * 2;
          pen.rotation.y += dAngle * lerpFactor;
          pen.rotation.z += (target.rotZ - pen.rotation.z) * lerpFactor;
        }

        const activePen = pens[turns.activePlayer];
        if (activePen) {
          turnRing.visible = turns.phase === 'player';
          turnRing.position.x = activePen.position.x;
          turnRing.position.z = activePen.position.z;
          turnRingMaterial.color.set(PEN_COLORS[turns.activePlayer] ?? '#37aaff');
          const ringPulse = reducedMotion ? 1 : 1 + Math.sin(time * 0.006) * 0.08;
          turnRing.scale.setScalar(ringPulse);
        }
        if (targetRing.visible) {
          const tRingPulse = reducedMotion ? 1 : 1 + Math.sin(time * 0.012) * 0.08;
          targetRing.scale.setScalar(tRingPulse);
        }
        return;
      }
      if (falling) {
        const fallState = falling;
        turnRing.visible = false;
        fallState.elapsed += delta;
        for (const [index, pen] of fallState.pens.entries()) {
          pen.position.y -= delta * 5.6;
          pen.rotation.x += delta * 5;
          pen.rotation.z += delta * (index % 2 === 0 ? 3.2 : -3.2);
        }
        if (!fallState.scored && fallState.elapsed >= 0.72) {
          fallState.scored = true;
          if (fallState.winner !== null) fallListener(fallState.winner);
          if (falling !== fallState) return;
        }
        if (fallState.elapsed >= 1.65) {
          falling = null;
          roundIndex += 1;
          currentServer = (currentServer + 1) % activePlayerCount;
          resetPenPositions(true);
          turns.finishPoint(currentServer);
          roundListener(null);
          turnListener(currentServer);
          actionListener(currentServer === 1 && matchMode === 'quick' ? 'aiWaiting' : 'ready');
        }
        return;
      }
      const activePen = activeHumanPen();
      turnRing.visible = turns.phase === 'player' || turns.phase === 'aiWaiting';
      turnRing.position.x = activePen.position.x;
      turnRing.position.z = activePen.position.z;
      turnRingMaterial.color.set(PEN_COLORS[turns.activePlayer] ?? '#37aaff');
      const ringPulse = reducedMotion ? 1 : 1 + Math.sin(time * 0.006) * 0.08;
      turnRing.scale.setScalar(ringPulse);
      if (targetRing.visible) {
        const tRingPulse = reducedMotion ? 1 : 1 + Math.sin(time * 0.012) * 0.08;
        targetRing.scale.setScalar(tRingPulse);
      }

      const simulated = Boolean(desk) && !replica;
      let physicsMotion = 0;
      let physicsSettled = false;
      const shotActive = turns.phase === 'playerMoving' || turns.phase === 'aiMoving';
      if (simulated && desk) {
        const step = desk.step(delta);
        for (const obstacle of activeChallenge.obstacles) {
          if (obstacle.kind !== 'chalk') continue;
          const pose = desk.obstaclePose(obstacle.id);
          const mesh = arena.getObjectByName(`arena-obstacle:${obstacle.id}`);
          if (pose && mesh) {
            mesh.position.set(pose.x, mesh.position.y, pose.z - activeChallenge.centerZ);
            mesh.rotation.y = pose.rotation;
          }
        }
        if (shotActive) {
          physicsMotion = step.totalMotion;
          physicsSettled = step.settled;
          desk.applyPoses(pens, activePlayerCount);
          if (step.tremorStrength > 0) hitListener(1.8 + step.tremorStrength * 8);
          for (const hit of step.hits) {
            const normal = new THREE.Vector2(1, 0);
            shockwave.position.set(hit.x, 2.585, hit.z);
            shockwave.scale.setScalar(0.4);
            shockwave.visible = true;
            shockwaveTimer = 0.35;
            (shockwave.material as THREE.MeshBasicMaterial).opacity = 0.95;
            impactStar.position.set(hit.x, 2.61, hit.z);
            impactStar.rotation.z = Math.random() * Math.PI;
            impactStar.scale.setScalar(1.5);
            impactStar.visible = true;
            starTimer = 0.22;
            (impactStar.material as THREE.MeshBasicMaterial).opacity = 1;
            spawnHitSparks(hit.x, hit.z, normal, hit.strength);
            playPenClackSound(hit.strength);
            hitListener(hit.strength);
          }
        } else {
          physicsSettled = true;
          physicsMotion = 0;
        }
      }
      for (let i = 0; i < activePlayerCount; i++) {
        const pen = pens[i];
        const velocity = penVelocities[i];
        if (!pen || !velocity || !pen.visible || turns.isEliminated(i) || simulated) continue;
        pen.position.x += velocity.x * delta;
        pen.position.z += velocity.y * delta;
        velocity.multiplyScalar(Math.exp(-2.05 * delta));
        pen.rotation.y += (penAngularVelocities[i] ?? 0) * delta;
        penAngularVelocities[i] = (penAngularVelocities[i] ?? 0) * Math.exp(-2.35 * delta);
        if (velocity.length() < 0.28) {
          velocity.set(0, 0);
          penAngularVelocities[i] = 0;
        }

        const wobble = penWobbles[i] ?? 0;
        if (wobble > 0.001) {
          pen.position.y = 2.62 + Math.abs(Math.sin(time * 0.04)) * wobble;
          pen.rotation.z += Math.sin(time * 0.05) * wobble * 0.4;
          penWobbles[i] = Math.max(0, wobble - delta * 0.85);
        } else {
          pen.position.y = 2.62;
          pen.rotation.z = 0;
        }
      }

      for (let i = 0; i < activePlayerCount; i++) {
        const pI = pens[i];
        const vI = penVelocities[i];
        if (!pI || !vI || turns.isEliminated(i) || !pI.visible || simulated) continue;
        for (let j = i + 1; j < activePlayerCount; j++) {
          const pJ = pens[j];
          const vJ = penVelocities[j];
          if (!pJ || !vJ || turns.isEliminated(j) || !pJ.visible) continue;
          const contact = capsuleContact(
            { x: pI.position.x, y: pI.position.z }, pI.rotation.y,
            { x: pJ.position.x, y: pJ.position.z }, pJ.rotation.y,
            PEN_HALF_LENGTH, PEN_RADIUS,
          );
          if (contact) {
            const normal = new THREE.Vector2(contact.normal.x, contact.normal.y);
            const relative = vI.clone().sub(vJ).dot(normal);
            const correction = normal.clone().multiplyScalar(contact.penetration * 0.54);
            pI.position.x -= correction.x;
            pI.position.z -= correction.y;
            pJ.position.x += correction.x;
            pJ.position.z += correction.y;
            if (relative > 0.25) {
              const [nextI, nextJ] = resolveEqualMassCollision(
                { x: pI.position.x, y: pI.position.z },
                { x: pJ.position.x, y: pJ.position.z },
                { x: vI.x, y: vI.y },
                { x: vJ.x, y: vJ.y },
                0.86,
                contact.normal,
              );
              vI.set(nextI.x, nextI.y);
              vJ.set(nextJ.x, nextJ.y);
              const tangent = new THREE.Vector2(-normal.y, normal.x);
              const glancingSpeed = vI.clone().sub(vJ).dot(tangent);
              penAngularVelocities[i] = (penAngularVelocities[i] ?? 0) - glancingSpeed * 0.13;
              penAngularVelocities[j] = (penAngularVelocities[j] ?? 0) + glancingSpeed * 0.13;

              const contactX = (pI.position.x + pJ.position.x) * 0.5;
              const contactZ = (pI.position.z + pJ.position.z) * 0.5;

              shockwave.position.set(contactX, 2.585, contactZ);
              shockwave.scale.setScalar(0.4);
              shockwave.visible = true;
              shockwaveTimer = 0.35;
              (shockwave.material as THREE.MeshBasicMaterial).opacity = 0.95;

              impactStar.position.set(contactX, 2.61, contactZ);
              impactStar.rotation.z = Math.random() * Math.PI;
              impactStar.scale.setScalar(1.5);
              impactStar.visible = true;
              starTimer = 0.22;
              (impactStar.material as THREE.MeshBasicMaterial).opacity = 1.0;

              spawnHitSparks(contactX, contactZ, normal, relative);

              const wobbleIntensity = THREE.MathUtils.clamp(relative * 0.045, 0.06, 0.24);
              penWobbles[i] = wobbleIntensity;
              penWobbles[j] = wobbleIntensity;

              playPenClackSound(relative);
              hitListener(relative);
            }
          }
        }
      }

      if (shockwaveTimer > 0) {
        shockwaveTimer -= delta;
        const progress = 1 - Math.max(0, shockwaveTimer / 0.35);
        shockwave.scale.setScalar(0.4 + progress * 3.4);
        (shockwave.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - progress) * 0.95);
        if (shockwaveTimer <= 0) shockwave.visible = false;
      }

      if (starTimer > 0) {
        starTimer -= delta;
        const starProgress = 1 - Math.max(0, starTimer / 0.22);
        impactStar.scale.setScalar(Math.max(0, (1 - starProgress) * 1.5));
        impactStar.rotation.z += delta * 7;
        (impactStar.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - starProgress);
        if (starTimer <= 0) impactStar.visible = false;
      }

      for (const spark of sparks) {
        if (!spark.active) continue;
        spark.life -= delta;
        if (spark.life <= 0) {
          spark.active = false;
          spark.mesh.visible = false;
          continue;
        }
        spark.mesh.position.x += spark.velocity.x * delta;
        spark.mesh.position.y += spark.velocity.y * delta;
        spark.mesh.position.z += spark.velocity.z * delta;
        spark.velocity.y -= 18 * delta;
        if (spark.mesh.position.y < 2.58) {
          spark.mesh.position.y = 2.58;
          spark.velocity.y = -spark.velocity.y * 0.3;
        }
        spark.mesh.rotation.x += spark.rotSpeed.x * delta;
        spark.mesh.rotation.y += spark.rotSpeed.y * delta;
        spark.mesh.rotation.z += spark.rotSpeed.z * delta;
        const sparkRatio = spark.life / spark.maxLife;
        spark.mesh.scale.setScalar(spark.baseScale * sparkRatio);
        (spark.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, sparkRatio * 1.4);
      }

      const shotIsResolving = turns.phase === 'playerMoving' || turns.phase === 'aiMoving';
      if (activePlayerCount === 2 && shotIsResolving) {
        const blueOut = simulated && desk
          ? desk.isOut(0)
          : blue.position.y < DESK_TOP - 0.2 || penHasFallen(blue.position.x, blue.position.z, blue.rotation.y, PEN_HALF_LENGTH);
        const redOut = simulated && desk
          ? desk.isOut(1)
          : red.position.y < DESK_TOP - 0.2 || penHasFallen(red.position.x, red.position.z, red.rotation.y, PEN_HALF_LENGTH);
        const winner = knockoutWinner(blueOut, redOut);
        if (winner !== null) {
          const fallenIndices = winner === 'draw' ? [0, 1] : [winner === 0 ? 1 : 0];
          falling = winner === 'draw'
            ? { pens: [blue, red], winner: null, elapsed: 0, scored: false }
            : { pens: [winner === 0 ? red : blue], winner, elapsed: 0, scored: false };
          for (const index of fallenIndices) desk?.release(index);
          actionListener('roundReset');
          roundListener(
            winner === 'draw'
              ? 'Double fall — replay the point'
              : matchMode === 'local'
                ? `Knockout — ${currentMatchPlayerNames[winner] ?? `Player ${winner + 1}`} scores`
                : winner === 0
                  ? 'Knockout — your point!'
                  : 'Knockout — rival scores',
          );
          blueVelocity.set(0, 0);
          redVelocity.set(0, 0);
          penAngularVelocities[0] = 0;
          penAngularVelocities[1] = 0;
          aimListener(0);
          aimLine.visible = false;
          aimHead.visible = false;
          turns.startFall();
          return;
        }
      } else if (activePlayerCount > 2 && shotIsResolving) {
        const newlyFallen: number[] = [];
        for (let i = 0; i < activePlayerCount; i++) {
          const pen = pens[i];
          if (!pen || turns.isEliminated(i) || !pen.visible) continue;
          const out = simulated && desk
            ? desk.isOut(i)
            : pen.position.y < DESK_TOP - 0.2 || penHasFallen(pen.position.x, pen.position.z, pen.rotation.y, PEN_HALF_LENGTH);
          if (out) {
            turns.eliminatePlayer(i);
            newlyFallen.push(i);
          }
        }
        if (newlyFallen.length > 0) {
          if (turns.remainingPlayerCount <= 1) {
            const surviving = turns.survivingPlayers;
            const winner: number | null = surviving.length === 1 ? (surviving[0] ?? null) : null;
            falling = {
              pens: newlyFallen.map((idx) => pens[idx]).filter((p): p is THREE.Group => Boolean(p)),
              winner,
              elapsed: 0,
              scored: false,
            };
            for (const index of newlyFallen) desk?.release(index);
            actionListener('roundReset');
            roundListener(
              winner === null
                ? 'Draw round — replay the point'
                : `Knockout — ${currentMatchPlayerNames[winner] ?? `Player ${winner + 1}`} scores`,
            );
            for (let i = 0; i < activePlayerCount; i++) {
              penVelocities[i]?.set(0, 0);
              penAngularVelocities[i] = 0;
            }
            aimListener(0);
            aimLine.visible = false;
            aimHead.visible = false;
            turns.startFall();
            return;
          } else {
            const eliminatedNames = newlyFallen.map((idx) => currentMatchPlayerNames[idx] ?? `Player ${idx + 1}`).join(', ');
            roundListener(`Knockout — ${eliminatedNames} eliminated!`);
            for (const idx of newlyFallen) {
              const p = pens[idx];
              if (p) p.position.y = -5;
              penVelocities[idx]?.set(0, 0);
              desk?.release(idx);
            }
          }
        }
      }

      let totalSpeed = 0;
      if (simulated && desk) {
        desk.copyMotion(penVelocities, penAngularVelocities);
        totalSpeed = physicsSettled ? 0 : physicsMotion;
      }
      else {
        for (let i = 0; i < activePlayerCount; i++) {
          const p = pens[i];
          const v = penVelocities[i];
          if (p && v && p.visible && !turns.isEliminated(i)) {
            totalSpeed += v.length();
          }
        }
      }

      const previousTurnPhase = turns.phase;
      const action = turns.tick(delta, totalSpeed);
      if (previousTurnPhase === 'playerMoving' && turns.phase === 'aiWaiting') {
        desk?.sleepPens();
        desk?.applyPoses(pens, activePlayerCount);
        turnListener(1);
        actionListener('aiWaiting');
      }
      if (action === 'aiFlick') {
        launchAi(time);
      } else if (action === 'playerReady') {
        for (let i = 0; i < activePlayerCount; i++) {
          penVelocities[i]?.set(0, 0);
          penAngularVelocities[i] = 0;
        }
        activatePendingDesk();
        desk?.sleepPens();
        desk?.applyPoses(pens, activePlayerCount);
        turnListener(turns.activePlayer);
        actionListener('ready');
      }
    },
    aim(deltaX: number, deltaY: number, grabShare?: number) {
      if (turns.phase !== 'player') return false;
      const pen = activeHumanPen();
      const opponent = inactiveHumanPen();
      if (!aimActive) {
        aimOrigin.copy(pen.position);
        aimOriginAngle = pen.rotation.y;
        aimActive = true;
        actionListener('aiming');
      }
      const aim = computeFlickAim(deltaX, deltaY, 1.8);
      if (grabShare === undefined) {
        shotSpin = 0;
        shotStrike = 0;
        shotEfficiency = 1;
        shotShaped = false;
      } else {
        const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(pen.quaternion);
        shotEfficiency = axialShotEfficiency(deltaX, deltaY, forward.x, forward.z);
        shotStrike = grabShare;
        shotSpin = spinFromGrab(grabShare, aim.power);
        shotShaped = true;
      }
      const assisted = assistedDirection(
        aim.direction,
        {
          x: opponent.position.x - aimOrigin.x,
          y: opponent.position.z - aimOrigin.z,
        },
        0.34,
        0.28,
      );
      shotAngle = Math.atan2(-assisted.y, assisted.x);
      aimPower = aim.power;
      const guideLength = 1.35 + aim.power * 4.4;
      aimGeometry.setFromPoints([
        new THREE.Vector3(aimOrigin.x, 2.74, aimOrigin.z),
        new THREE.Vector3(
          aimOrigin.x + Math.cos(shotAngle) * guideLength,
          2.74,
          aimOrigin.z - Math.sin(shotAngle) * guideLength,
        ),
      ]);
      const showGuide = aim.power > 0.03;
      aimLine.visible = showGuide;
      const aimDirection = new THREE.Vector3(Math.cos(shotAngle), 0, -Math.sin(shotAngle));
      aimHead.position.set(
        aimOrigin.x + aimDirection.x * guideLength,
        2.74,
        aimOrigin.z + aimDirection.z * guideLength,
      );
      aimHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aimDirection);
      aimHead.visible = showGuide;

      for (let i = 0; i < aimDots.length; i++) {
        const fraction = (i + 1) / (aimDots.length + 1);
        const dotDist = guideLength * fraction;
        const dot = aimDots[i]!;
        dot.position.set(
          aimOrigin.x + aimDirection.x * dotDist,
          2.70,
          aimOrigin.z + aimDirection.z * dotDist,
        );
        const scale = (0.7 + fraction * 0.5) * Math.min(1.2, 0.4 + aim.power * 1.3);
        dot.scale.setScalar(scale);
        dot.visible = showGuide;
      }

      if (showGuide && opponent) {
        targetRing.position.x = opponent.position.x;
        targetRing.position.z = opponent.position.z;
        targetRingMaterial.opacity = THREE.MathUtils.clamp(aim.power * 1.4, 0.35, 0.88);
        targetRing.visible = true;
      } else {
        targetRing.visible = false;
      }

      aimListener(aim.power);
      return true;
    },
    flick() {
      if (turns.phase !== 'player') return false;
      const pen = activeHumanPen();
      if (aimPower <= 0) {
        if (aimActive) {
          pen.position.copy(aimOrigin);
          pen.rotation.y = aimOriginAngle;
        }
        aimActive = false;
        aimPower = 0;
        aimListener(0);
        aimLine.visible = false;
        aimHead.visible = false;
        for (const dot of aimDots) dot.visible = false;
        targetRing.visible = false;
        actionListener('ready');
        return false;
      }
      if (!turns.playerFlicked()) return false;
      const curve = shotShaped ? aimPower : Math.pow(aimPower, 0.7);
      const strength = impulseMagnitude(curve * shotEfficiency, 1);
      pen.position.copy(aimOrigin);
      pen.rotation.y = aimOriginAngle;
      activatePendingDesk();
      if (desk) {
        desk.strike(turns.activePlayer, shotStrike, Math.cos(shotAngle), -Math.sin(shotAngle), curve * shotEfficiency);
      } else {
        activeHumanVelocity().set(Math.cos(shotAngle) * strength, -Math.sin(shotAngle) * strength);
        penAngularVelocities[turns.activePlayer] = shotSpin;
      }
      shotSpin = 0;
      shotStrike = 0;
      shotEfficiency = 1;
      shotShaped = false;
      aimActive = false;
      aimPower = 0;
      aimListener(0);
      aimLine.visible = false;
      aimHead.visible = false;
      for (const dot of aimDots) dot.visible = false;
      targetRing.visible = false;
      actionListener('playerMoving');
      return true;
    },
    cancelAim() {
      if (turns.phase !== 'player' || !aimActive) return;
      const pen = activeHumanPen();
      pen.position.copy(aimOrigin);
      pen.rotation.y = aimOriginAngle;
      aimActive = false;
      aimPower = 0;
      shotSpin = 0;
      shotStrike = 0;
      shotEfficiency = 1;
      shotShaped = false;
      aimListener(0);
      aimLine.visible = false;
      aimHead.visible = false;
      for (const dot of aimDots) dot.visible = false;
      targetRing.visible = false;
      actionListener('ready');
    },
    grabShare(raycaster: THREE.Raycaster) {
      if (turns.phase !== 'player') return 0;
      const pen = activeHumanPen();
      const hits = raycaster.intersectObject(pen, true);
      const hit = hits.find((item) => item.object.name === 'pen-pickup-target') ?? hits[0];
      if (!hit) return 0;
      const local = pen.worldToLocal(hit.point.clone());
      return grabSpinShare(local.x, PEN_HALF_LENGTH);
    },
    resetPens() {
      falling = null;
      turns.finishPoint(0);
      resetPenPositions(false);
      turnRing.visible = true;
      roundListener(null);
      actionListener('ready');
    },
    canGrab(raycaster: THREE.Raycaster) {
      if (turns.phase !== 'player') return false;
      return raycaster.intersectObject(activeHumanPen(), true).length > 0;
    },
    setFallListener(listener: (winner: number) => void) {
      fallListener = listener;
    },
    setTurnListener(listener: (player: number) => void) {
      turnListener = listener;
    },
    setAimListener(listener: (power: number) => void) {
      aimListener = listener;
    },
    setRoundListener(listener: (message: string | null) => void) {
      roundListener = listener;
    },
    setActionListener(listener: (action: ArenaAction) => void) {
      actionListener = listener;
    },
    setHitListener(listener: (intensity: number) => void) {
      hitListener = listener;
    },
    setMatchMode(mode: MatchMode, playerCount = 2, playerNames?: readonly string[], challenge?: ArenaChallenge) {
      matchMode = mode;
      applyChallenge(mode === 'quick' ? challenge : STANDARD_ARENA);
      activePlayerCount = Math.max(2, Math.min(4, playerCount));
      currentMatchPlayerNames = playerNames && playerNames.length >= activePlayerCount
        ? playerNames
        : Array.from({ length: activePlayerCount }, (_, i) => `Player ${i + 1}`);
      roundIndex = 0;
      currentServer = 0;
      turns.begin(mode, 0, activePlayerCount);
      resetPenPositions(true);
      actionListener('ready');
      turnListener(0);
    },
    getArenaSnapshot(seq, score) {
      return {
        seq,
        pens: [
          {
            x: r3(blue.position.x),
            y: r3(blue.position.y),
            z: r3(blue.position.z),
            angle: r3(blue.rotation.y),
            rotationX: r3(blue.rotation.x),
            rotationZ: r3(blue.rotation.z),
            velocityX: r3(blueVelocity.x),
            velocityZ: r3(blueVelocity.y),
            angularVelocity: r3(penAngularVelocities[0] ?? 0),
          },
          {
            x: r3(red.position.x),
            y: r3(red.position.y),
            z: r3(red.position.z),
            angle: r3(red.rotation.y),
            rotationX: r3(red.rotation.x),
            rotationZ: r3(red.rotation.z),
            velocityX: r3(redVelocity.x),
            velocityZ: r3(redVelocity.y),
            angularVelocity: r3(penAngularVelocities[1] ?? 0),
          },
        ],
        score: [score[0] ?? 0, score[1] ?? 0],
        currentPlayer: (turns.activePlayer as 0 | 1),
        phase: falling ? 'falling' : turns.phase,
      };
    },
    applyArenaSnapshot(snapshot) {
      const [blueState, redState] = snapshot.pens;
      const bTarget = replicaTargets[0]!;
      const rTarget = replicaTargets[1]!;

      // Distance check to snap on teleport/reset
      const distSq = (blue.position.x - blueState.x) ** 2 + (blue.position.z - blueState.z) ** 2;
      const snapDirectly = !bTarget.active || distSq > 3;

      bTarget.x = blueState.x;
      bTarget.y = blueState.y;
      bTarget.z = blueState.z;
      bTarget.rotX = blueState.rotationX;
      bTarget.angle = blueState.angle;
      bTarget.rotZ = blueState.rotationZ;
      bTarget.vx = blueState.velocityX;
      bTarget.vz = blueState.velocityZ;
      bTarget.av = blueState.angularVelocity;
      bTarget.active = true;

      rTarget.x = redState.x;
      rTarget.y = redState.y;
      rTarget.z = redState.z;
      rTarget.rotX = redState.rotationX;
      rTarget.angle = redState.angle;
      rTarget.rotZ = redState.rotationZ;
      rTarget.vx = redState.velocityX;
      rTarget.vz = redState.velocityZ;
      rTarget.av = redState.angularVelocity;
      rTarget.active = true;

      if (snapDirectly) {
        blue.position.set(blueState.x, blueState.y, blueState.z);
        blue.rotation.set(blueState.rotationX, blueState.angle, blueState.rotationZ);
        blueVelocity.set(blueState.velocityX, blueState.velocityZ);
        penAngularVelocities[0] = blueState.angularVelocity;

        red.position.set(redState.x, redState.y, redState.z);
        red.rotation.set(redState.rotationX, redState.angle, redState.rotationZ);
        redVelocity.set(redState.velocityX, redState.velocityZ);
        penAngularVelocities[1] = redState.angularVelocity;
      }
      turns.syncState(snapshot.currentPlayer, snapshot.phase);
      if (snapshot.phase === 'player' && !aimActive) {
        actionListener('ready');
      } else if (snapshot.phase === 'falling') {
        actionListener('roundReset');
      } else if (snapshot.phase === 'playerMoving') {
        actionListener('playerMoving');
      }
    },
    setReplica(value) {
      replica = value;
      if (!value) {
        replicaTargets[0]!.active = false;
        replicaTargets[1]!.active = false;
      }
    },
    setCosmetics(penIds, deskId) {
      for (let index = 0; index < pens.length; index += 1) {
        const pen = pens[index];
        if (!pen) continue;
        const cosmetic = penById(penIds[index] ?? defaultPenIds[index] ?? 'classic-blue');
        const barrel = pen.getObjectByName('pen-cosmetic-barrel') as THREE.Mesh | undefined;
        const grip = pen.getObjectByName('pen-cosmetic-grip') as THREE.Mesh | undefined;
        const barrelMaterial = barrel?.material as THREE.MeshPhysicalMaterial | undefined;
        const gripMaterial = grip?.material as THREE.MeshStandardMaterial | undefined;
        barrelMaterial?.color.set(cosmetic.primary);
        if (barrelMaterial) {
          barrelMaterial.metalness = cosmetic.metalness;
          barrelMaterial.roughness = cosmetic.roughness;
        }
        gripMaterial?.color.set(cosmetic.accent);
      }
      const deskCosmetic = deskById(deskId);
      arenaWood.color.set(deskCosmetic.surface);
      wood.color.set(deskCosmetic.trim);
      (backWall.material as THREE.MeshStandardMaterial).color.set(deskCosmetic.room);
    },
    ready,
    isPenMoving() {
      return (
        Boolean(falling) ||
        blueVelocity.lengthSq() > 0.001 ||
        redVelocity.lengthSq() > 0.001 ||
        Math.abs(penAngularVelocities[0] ?? 0) > 0.01 ||
        Math.abs(penAngularVelocities[1] ?? 0) > 0.01
      );
    },
  };
}

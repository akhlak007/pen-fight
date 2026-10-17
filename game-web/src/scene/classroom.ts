import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MatchMode } from '../app/app-state';
import type { ArenaSnapshot } from '../network/protocol';
import { type ArenaAction, SoloTurnController } from '../game/solo-turn-controller';
import {
  AI_CORNER,
  assistedDirection,
  capsuleContact,
  computeFlickAim,
  knockoutWinner,
  penHasFallen,
  PLAYER_CORNER,
  resolveEqualMassCollision,
} from '../game/pen-rules';
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
  const hitTarget = new THREE.Mesh(
    new THREE.BoxGeometry(4.3, 0.72, 1.05),
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

function createArenaTable(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(9.2, 0.46, 12.85, 5, 0.16), material);
  top.position.y = 2.32;
  group.add(top);
  const apronMaterial = new THREE.MeshStandardMaterial({ color: '#4b2c18', roughness: 0.62, metalness: 0.03 });
  const frontApron = new THREE.Mesh(new RoundedBoxGeometry(8.65, 0.55, 0.2, 3, 0.05), apronMaterial);
  frontApron.position.set(0, 2.02, 6.18);
  const backApron = frontApron.clone();
  backApron.position.z = -6.18;
  const sideApron = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.55, 12.15, 3, 0.05), apronMaterial);
  sideApron.position.set(4.35, 2.02, 0);
  const otherSideApron = sideApron.clone();
  otherSideApron.position.x = -4.35;
  group.add(frontApron, backApron, sideApron, otherSideApron);

  const metal = new THREE.MeshStandardMaterial({ color: '#17191a', metalness: 0.8, roughness: 0.27 });
  for (const x of [-3.55, 3.55]) {
    for (const z of [-5.05, 5.05]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.27, 2.2, 0.27, 2, 0.05), metal);
      leg.position.set(x, 1.08, z);
      group.add(leg);
    }
  }
  const crossbar = new THREE.Mesh(new RoundedBoxGeometry(7.25, 0.16, 0.16, 2, 0.04), metal);
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
  addStrip(0.055, 11.7, 0, 0, accent);
  addStrip(8.5, 0.045, 0, 0, marking);
  addStrip(8.5, 0.045, 0, -5.82, marking);
  addStrip(8.5, 0.045, 0, 5.82, marking);
  addStrip(0.045, 11.68, -4.25, 0, marking);
  addStrip(0.045, 11.68, 4.25, 0, marking);

  for (const [x, z] of [[-3.72, 5.25], [3.72, -5.25]] as const) {
    const zone = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.48, 48), accent);
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(x, 2.562, z);
    group.add(zone);
  }
  enableShadows(group);
  return group;
}

export interface ClassroomScene {
  readonly group: THREE.Group;
  readonly heroPens: THREE.Group;
  updateBoard(playerName: string, opponentName?: string, score?: readonly [number, number]): void;
  update(time: number, delta: number, reducedMotion: boolean): void;
  aim(deltaX: number, deltaY: number): boolean;
  flick(): boolean;
  cancelAim(): void;
  resetPens(): void;
  canGrab(raycaster: THREE.Raycaster): boolean;
  setFallListener(listener: (winner: 0 | 1) => void): void;
  setTurnListener(listener: (player: 0 | 1) => void): void;
  setAimListener(listener: (power: number) => void): void;
  setRoundListener(listener: (message: string | null) => void): void;
  setActionListener(listener: (action: ArenaAction) => void): void;
  setMatchMode(mode: MatchMode): void;
  getArenaSnapshot(seq: number, score: readonly [number, number]): ArenaSnapshot;
  applyArenaSnapshot(snapshot: ArenaSnapshot): void;
  setReplica(value: boolean): void;
}

export function createClassroom(): ClassroomScene {
  const group = new THREE.Group();
  let replica = false;
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

  const arena = createArenaTable(arenaWood);
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

  const heroPens = new THREE.Group();
  heroPens.name = 'hero-pens';
  const blue = createPen('#128de0');
  blue.rotation.y = 1.08;
  blue.position.set(PLAYER_CORNER.x, 2.62, PLAYER_CORNER.z);
  const red = createPen('#d94f35');
  red.rotation.y = -2.05;
  red.position.set(AI_CORNER.x, 2.64, AI_CORNER.z);
  heroPens.add(blue, red);
  group.add(heroPens);

  const blueStart = blue.position.clone();
  const redStart = red.position.clone();
  const blueVelocity = new THREE.Vector2();
  const redVelocity = new THREE.Vector2();
  const turns = new SoloTurnController();
  let matchMode: MatchMode = 'quick';
  let shotAngle = 1.08;
  let aimPower = 0;
  const aimOrigin = blueStart.clone();
  let aimOriginAngle = blue.rotation.y;
  let aimActive = false;
  let blueAngularVelocity = 0;
  let redAngularVelocity = 0;
  let fallListener: (winner: 0 | 1) => void = () => undefined;
  let turnListener: (player: 0 | 1) => void = () => undefined;
  let aimListener: (power: number) => void = () => undefined;
  let roundListener: (message: string | null) => void = () => undefined;
  let actionListener: (action: ArenaAction) => void = () => undefined;
  let falling: {
    pens: readonly THREE.Group[];
    winner: 0 | 1 | null;
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
    new THREE.ConeGeometry(0.16, 0.42, 12),
    new THREE.MeshBasicMaterial({ color: '#f5d34f', transparent: true, opacity: 0.94 }),
  );
  aimHead.visible = false;
  group.add(aimLine, aimHead);

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

  function resetPenPositions(): void {
    blue.position.copy(blueStart);
    red.position.copy(redStart);
    blue.rotation.set(0, 1.08, 0);
    red.rotation.set(0, -2.05, 0);
    blueVelocity.set(0, 0);
    redVelocity.set(0, 0);
    blueAngularVelocity = 0;
    redAngularVelocity = 0;
    aimPower = 0;
    aimOrigin.copy(blueStart);
    aimOriginAngle = 1.08;
    aimActive = false;
    aimListener(0);
    aimLine.visible = false;
    aimHead.visible = false;
  }

  function launchAi(time: number): void {
    const dx = blue.position.x - red.position.x;
    const dz = blue.position.z - red.position.z;
    const error = Math.sin(time * 0.0037) * 0.14;
    const angle = Math.atan2(-dz, dx) + error;
    const distance = Math.hypot(dx, dz);
    const strength = THREE.MathUtils.clamp(distance * 1.2, 9.6, 14.2);
    red.rotation.y = angle;
    redVelocity.set(Math.cos(angle) * strength, -Math.sin(angle) * strength);
    redAngularVelocity = error * 1.8;
    actionListener('aiMoving');
    turnListener(1);
  }

  function activeHumanPen(): THREE.Group {
    return turns.activePlayer === 0 ? blue : red;
  }

  function inactiveHumanPen(): THREE.Group {
    return turns.activePlayer === 0 ? red : blue;
  }

  function activeHumanVelocity(): THREE.Vector2 {
    return turns.activePlayer === 0 ? blueVelocity : redVelocity;
  }

  function stopActiveHumanSpin(): void {
    if (turns.activePlayer === 0) blueAngularVelocity = 0;
    else redAngularVelocity = 0;
  }

  return {
    group,
    heroPens,
    updateBoard(playerName: string, opponentName = 'AI rival', score: readonly [number, number] = [0, 0]) {
      const previous = boardMaterial.map;
      boardMaterial.map = createBlackboardTexture(playerName, opponentName, score);
      boardMaterial.needsUpdate = true;
      previous?.dispose();
    },
    update(time: number, delta: number, reducedMotion: boolean) {
      if (!reducedMotion) bagBlue.rotation.z = Math.sin(time * 0.00035) * 0.008;
      if (replica) return;
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
          resetPenPositions();
          turns.finishPoint();
          roundListener(null);
          turnListener(0);
          actionListener('ready');
        }
        return;
      }
      const activePen = turns.activePlayer === 0 ? blue : red;
      turnRing.visible = turns.phase === 'player' || turns.phase === 'aiWaiting';
      turnRing.position.x = activePen.position.x;
      turnRing.position.z = activePen.position.z;
      turnRingMaterial.color.set(turns.activePlayer === 0 ? '#37aaff' : '#e65e3d');
      const ringPulse = reducedMotion ? 1 : 1 + Math.sin(time * 0.006) * 0.08;
      turnRing.scale.setScalar(ringPulse);
      for (const [pen, velocity] of [[blue, blueVelocity], [red, redVelocity]] as const) {
        pen.position.x += velocity.x * delta;
        pen.position.z += velocity.y * delta;
        velocity.multiplyScalar(Math.exp(-2.05 * delta));
      }
      blue.rotation.y += blueAngularVelocity * delta;
      red.rotation.y += redAngularVelocity * delta;
      blueAngularVelocity *= Math.exp(-2.35 * delta);
      redAngularVelocity *= Math.exp(-2.35 * delta);
      const contact = capsuleContact(
        { x: blue.position.x, y: blue.position.z }, blue.rotation.y,
        { x: red.position.x, y: red.position.z }, red.rotation.y,
      );
      if (contact) {
        const normal = new THREE.Vector2(contact.normal.x, contact.normal.y);
        const relative = blueVelocity.clone().sub(redVelocity).dot(normal);
        const correction = normal.clone().multiplyScalar(contact.penetration * 0.54);
        blue.position.x -= correction.x;
        blue.position.z -= correction.y;
        red.position.x += correction.x;
        red.position.z += correction.y;
        if (relative > 0.25) {
          const [nextBlue, nextRed] = resolveEqualMassCollision(
            { x: blue.position.x, y: blue.position.z },
            { x: red.position.x, y: red.position.z },
            { x: blueVelocity.x, y: blueVelocity.y },
            { x: redVelocity.x, y: redVelocity.y },
            0.86,
            contact.normal,
          );
          blueVelocity.set(nextBlue.x, nextBlue.y);
          redVelocity.set(nextRed.x, nextRed.y);
          const tangent = new THREE.Vector2(-normal.y, normal.x);
          const glancingSpeed = blueVelocity.clone().sub(redVelocity).dot(tangent);
          blueAngularVelocity -= glancingSpeed * 0.13;
          redAngularVelocity += glancingSpeed * 0.13;
        }
      }
      const blueOut = penHasFallen(blue.position.x, blue.position.z, blue.rotation.y);
      const redOut = penHasFallen(red.position.x, red.position.z, red.rotation.y);
      const winner = knockoutWinner(blueOut, redOut);
      if (winner !== null) {
        falling = winner === 'draw'
          ? { pens: [blue, red], winner: null, elapsed: 0, scored: false }
          : { pens: [winner === 0 ? red : blue], winner, elapsed: 0, scored: false };
        actionListener('roundReset');
        roundListener(
          winner === 'draw'
            ? 'Double fall — replay the point'
            : matchMode === 'local'
              ? `Knockout — Player ${winner + 1} scores`
              : winner === 0
                ? 'Knockout — your point!'
                : 'Knockout — rival scores',
        );
        blueVelocity.set(0, 0);
        redVelocity.set(0, 0);
        blueAngularVelocity = 0;
        redAngularVelocity = 0;
        aimListener(0);
        aimLine.visible = false;
        aimHead.visible = false;
        turns.startFall();
        return;
      }
      const previousTurnPhase = turns.phase;
      const action = turns.tick(delta, blueVelocity.length() + redVelocity.length());
      if (previousTurnPhase === 'playerMoving' && turns.phase === 'aiWaiting') {
        turnListener(1);
        actionListener('aiWaiting');
      }
      if (action === 'aiFlick') {
        launchAi(time);
      } else if (action === 'playerReady') {
        blueVelocity.set(0, 0);
        redVelocity.set(0, 0);
        blueAngularVelocity = 0;
        redAngularVelocity = 0;
        turnListener(turns.activePlayer);
        actionListener('ready');
      }
    },
    aim(deltaX: number, deltaY: number) {
      if (turns.phase !== 'player') return false;
      const pen = activeHumanPen();
      const opponent = inactiveHumanPen();
      if (!aimActive) {
        aimOrigin.copy(pen.position);
        aimOriginAngle = pen.rotation.y;
        aimActive = true;
        actionListener('aiming');
      }
      const aim = computeFlickAim(deltaX, deltaY, 2.4);
      const assisted = assistedDirection(aim.direction, {
        x: opponent.position.x - aimOrigin.x,
        y: opponent.position.z - aimOrigin.z,
      });
      shotAngle = Math.atan2(-assisted.y, assisted.x);
      aimPower = aim.power;
      const guideLength = 1.35 + aim.power * 4.2;
      aimGeometry.setFromPoints([
        new THREE.Vector3(aimOrigin.x, 2.74, aimOrigin.z),
        new THREE.Vector3(
          aimOrigin.x + Math.cos(shotAngle) * guideLength,
          2.74,
          aimOrigin.z - Math.sin(shotAngle) * guideLength,
        ),
      ]);
      aimLine.visible = aim.power > 0.04;
      const aimDirection = new THREE.Vector3(Math.cos(shotAngle), 0, -Math.sin(shotAngle));
      aimHead.position.set(
        aimOrigin.x + aimDirection.x * guideLength,
        2.74,
        aimOrigin.z + aimDirection.z * guideLength,
      );
      aimHead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aimDirection);
      aimHead.visible = aim.power > 0.04;
      aimListener(aim.power);
      return true;
    },
    flick() {
      if (turns.phase !== 'player') return false;
      const pen = activeHumanPen();
      if (aimPower < 0.08) {
        if (aimActive) {
          pen.position.copy(aimOrigin);
          pen.rotation.y = aimOriginAngle;
        }
        aimActive = false;
        aimPower = 0;
        aimListener(0);
        aimLine.visible = false;
        aimHead.visible = false;
        actionListener('ready');
        return false;
      }
      if (!turns.playerFlicked()) return false;
      const strength = THREE.MathUtils.lerp(4.6, 15.2, Math.pow(aimPower, 0.72));
      activeHumanVelocity().set(Math.cos(shotAngle) * strength, -Math.sin(shotAngle) * strength);
      pen.position.copy(aimOrigin);
      stopActiveHumanSpin();
      aimActive = false;
      aimPower = 0;
      aimListener(0);
      aimLine.visible = false;
      aimHead.visible = false;
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
      aimListener(0);
      aimLine.visible = false;
      aimHead.visible = false;
      actionListener('ready');
    },
    resetPens() {
      falling = null;
      turns.finishPoint();
      resetPenPositions();
      turnRing.visible = true;
      roundListener(null);
      actionListener('ready');
    },
    canGrab(raycaster: THREE.Raycaster) {
      return turns.phase === 'player' && raycaster.intersectObject(activeHumanPen(), true).length > 0;
    },
    setFallListener(listener: (winner: 0 | 1) => void) {
      fallListener = listener;
    },
    setTurnListener(listener: (player: 0 | 1) => void) {
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
    setMatchMode(mode: MatchMode) {
      matchMode = mode;
      turns.begin(mode);
      resetPenPositions();
      actionListener('ready');
      turnListener(0);
    },
    getArenaSnapshot(seq, score) {
      return { seq, pens: [
        { x: blue.position.x, y: blue.position.y, z: blue.position.z, angle: blue.rotation.y, rotationX: blue.rotation.x, rotationZ: blue.rotation.z, velocityX: blueVelocity.x, velocityZ: blueVelocity.y, angularVelocity: blueAngularVelocity },
        { x: red.position.x, y: red.position.y, z: red.position.z, angle: red.rotation.y, rotationX: red.rotation.x, rotationZ: red.rotation.z, velocityX: redVelocity.x, velocityZ: redVelocity.y, angularVelocity: redAngularVelocity },
      ], score: [score[0], score[1]], currentPlayer: turns.activePlayer, phase: falling ? 'falling' : turns.phase };
    },
    applyArenaSnapshot(snapshot) {
      const [blueState, redState] = snapshot.pens;
      blue.position.set(blueState.x, blueState.y, blueState.z); blue.rotation.set(blueState.rotationX, blueState.angle, blueState.rotationZ); blueVelocity.set(blueState.velocityX, blueState.velocityZ); blueAngularVelocity = blueState.angularVelocity;
      red.position.set(redState.x, redState.y, redState.z); red.rotation.set(redState.rotationX, redState.angle, redState.rotationZ); redVelocity.set(redState.velocityX, redState.velocityZ); redAngularVelocity = redState.angularVelocity;
      turns.syncState(snapshot.currentPlayer, snapshot.phase);
    },
    setReplica(value) { replica = value; },
  };
}

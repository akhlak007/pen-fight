import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SoloTurnController } from '../game/solo-turn-controller';
import { AI_CORNER, isOutsideTable, knockoutWinner, PLAYER_CORNER, resolveEqualMassCollision } from '../game/pen-rules';
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
  const top = new THREE.Mesh(new RoundedBoxGeometry(8.25, 0.42, 14.1, 4, 0.1), material);
  top.position.y = 2.32;
  group.add(top);
  const metal = new THREE.MeshStandardMaterial({ color: '#11100e', metalness: 0.76, roughness: 0.32 });
  for (const x of [-3.15, 3.15]) {
    for (const z of [-5.85, 5.85]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.24, 2.2, 0.24, 2, 0.04), metal);
      leg.position.set(x, 1.08, z);
      group.add(leg);
    }
  }
  enableShadows(group);
  return group;
}

export interface ClassroomScene {
  readonly group: THREE.Group;
  readonly heroPens: THREE.Group;
  updateBoard(playerName: string, score?: readonly [number, number]): void;
  update(time: number, delta: number, reducedMotion: boolean): void;
  aim(deltaX: number, pull: number): void;
  flick(power: number): void;
  cancelAim(): void;
  resetPens(): void;
  canGrab(raycaster: THREE.Raycaster): boolean;
  setFallListener(listener: (winner: 0 | 1) => void): void;
  setTurnListener(listener: (player: 0 | 1) => void): void;
  setMatchMode(mode: 'quick' | 'practice'): void;
}

export function createClassroom(): ClassroomScene {
  const group = new THREE.Group();
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
  const red = createPen('#4a8ec7');
  red.rotation.y = -2.05;
  red.position.set(AI_CORNER.x, 2.64, AI_CORNER.z);
  heroPens.add(blue, red);
  group.add(heroPens);

  const blueStart = blue.position.clone();
  const redStart = red.position.clone();
  const blueVelocity = new THREE.Vector2();
  const redVelocity = new THREE.Vector2();
  const turns = new SoloTurnController();
  let shotAngle = 1.08;
  let fallListener: (winner: 0 | 1) => void = () => undefined;
  let turnListener: (player: 0 | 1) => void = () => undefined;
  let falling: { pen: THREE.Group; winner: 0 | 1; elapsed: number } | null = null;

  const aimGeometry = new THREE.BufferGeometry();
  const aimLine = new THREE.Line(
    aimGeometry,
    new THREE.LineBasicMaterial({ color: '#f5d34f', transparent: true, opacity: 0.92 }),
  );
  aimLine.visible = false;
  group.add(aimLine);

  function resetPenPositions(): void {
    blue.position.copy(blueStart);
    red.position.copy(redStart);
    blue.rotation.set(0, 1.08, 0);
    red.rotation.set(0, -2.05, 0);
    blueVelocity.set(0, 0);
    redVelocity.set(0, 0);
    aimLine.visible = false;
  }

  function launchAi(time: number): void {
    const dx = blue.position.x - red.position.x;
    const dz = blue.position.z - red.position.z;
    const error = Math.sin(time * 0.0037) * 0.14;
    const angle = Math.atan2(-dz, dx) + error;
    const distance = Math.hypot(dx, dz);
    const strength = THREE.MathUtils.clamp(distance * 0.92, 7.2, 11.2);
    red.rotation.y = angle;
    redVelocity.set(Math.cos(angle) * strength, -Math.sin(angle) * strength);
    turnListener(1);
  }

  return {
    group,
    heroPens,
    updateBoard(playerName: string, score: readonly [number, number] = [0, 0]) {
      const previous = boardMaterial.map;
      boardMaterial.map = createBlackboardTexture(playerName, score);
      boardMaterial.needsUpdate = true;
      previous?.dispose();
    },
    update(time: number, delta: number, reducedMotion: boolean) {
      if (!reducedMotion) bagBlue.rotation.z = Math.sin(time * 0.00035) * 0.008;
      if (falling) {
        falling.elapsed += delta;
        falling.pen.position.y -= delta * 5.6;
        falling.pen.rotation.x += delta * 5;
        falling.pen.rotation.z += delta * 3.2;
        if (falling.elapsed >= 0.72) {
          const winner = falling.winner;
          falling = null;
          resetPenPositions();
          turns.finishPoint();
          fallListener(winner);
          turnListener(0);
        }
        return;
      }
      for (const [pen, velocity] of [[blue, blueVelocity], [red, redVelocity]] as const) {
        pen.position.x += velocity.x * delta;
        pen.position.z += velocity.y * delta;
        velocity.multiplyScalar(Math.exp(-1.55 * delta));
        pen.rotation.y += velocity.length() * delta * 0.8;
      }
      const separation = new THREE.Vector2(red.position.x - blue.position.x, red.position.z - blue.position.z);
      const penDistance = separation.length();
      if (penDistance < 0.78 && penDistance > 0.001) {
        const normal = separation.multiplyScalar(1 / penDistance);
        const relative = blueVelocity.clone().sub(redVelocity).dot(normal);
        if (relative > 0.25) {
          const [nextBlue, nextRed] = resolveEqualMassCollision(
            { x: blue.position.x, y: blue.position.z },
            { x: red.position.x, y: red.position.z },
            { x: blueVelocity.x, y: blueVelocity.y },
            { x: redVelocity.x, y: redVelocity.y },
          );
          blueVelocity.set(nextBlue.x, nextBlue.y);
          redVelocity.set(nextRed.x, nextRed.y);
          const correction = normal.clone().multiplyScalar((0.78 - penDistance) * 0.52);
          blue.position.x -= correction.x;
          blue.position.z -= correction.y;
          red.position.x += correction.x;
          red.position.z += correction.y;
        }
      }
      const blueOut = isOutsideTable(blue.position.x, blue.position.z);
      const redOut = isOutsideTable(red.position.x, red.position.z);
      const winner = knockoutWinner(blueOut, redOut);
      if (winner !== null) {
        falling = { pen: winner === 0 ? red : blue, winner, elapsed: 0 };
        blueVelocity.set(0, 0);
        redVelocity.set(0, 0);
        aimLine.visible = false;
        turns.startFall();
        return;
      }
      const previousTurnPhase = turns.phase;
      const action = turns.tick(delta, blueVelocity.length() + redVelocity.length());
      if (previousTurnPhase === 'playerMoving' && turns.phase === 'aiWaiting') turnListener(1);
      if (action === 'aiFlick') {
        launchAi(time);
      } else if (action === 'playerReady') {
        turnListener(0);
      }
    },
    aim(deltaX: number, pull: number) {
      if (turns.phase !== 'player') return;
      const dx = red.position.x - blue.position.x;
      const dz = red.position.z - blue.position.z;
      const baseAngle = Math.atan2(-dz, dx);
      shotAngle = baseAngle + THREE.MathUtils.clamp(deltaX * 0.0055, -0.82, 0.82);
      blue.rotation.y = shotAngle;
      blue.position.z = blueStart.z + THREE.MathUtils.clamp(pull * 0.006, 0, 0.7);
      const guideLength = 1.8 + THREE.MathUtils.clamp(pull * 0.016, 0, 3.6);
      aimGeometry.setFromPoints([
        new THREE.Vector3(blue.position.x, 2.74, blue.position.z),
        new THREE.Vector3(
          blue.position.x + Math.cos(shotAngle) * guideLength,
          2.74,
          blue.position.z - Math.sin(shotAngle) * guideLength,
        ),
      ]);
      aimLine.visible = true;
    },
    flick(power: number) {
      if (!turns.playerFlicked()) return;
      const strength = THREE.MathUtils.clamp(power * 55, 3.4, 12.5);
      blueVelocity.set(Math.cos(shotAngle) * strength, -Math.sin(shotAngle) * strength);
      blue.position.z = blueStart.z;
      aimLine.visible = false;
    },
    cancelAim() {
      if (turns.phase !== 'player') return;
      blue.position.copy(blueStart);
      aimLine.visible = false;
    },
    resetPens() {
      falling = null;
      turns.finishPoint();
      resetPenPositions();
    },
    canGrab(raycaster: THREE.Raycaster) {
      return turns.phase === 'player' && raycaster.intersectObject(blue, true).length > 0;
    },
    setFallListener(listener: (winner: 0 | 1) => void) {
      fallListener = listener;
    },
    setTurnListener(listener: (player: 0 | 1) => void) {
      turnListener = listener;
    },
    setMatchMode(mode: 'quick' | 'practice') {
      turns.begin(mode);
      resetPenPositions();
      turnListener(0);
    },
  };
}

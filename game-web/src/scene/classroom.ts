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
  const penVisual = new THREE.Group();
  penVisual.scale.setScalar(0.75);

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
  penVisual.add(barrel);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.72, 18), new THREE.MeshStandardMaterial({ color: '#e4f3ff', roughness: 0.48 }));
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

function createArenaTable(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(11.8, 0.46, 14.8, 5, 0.16), material);
  top.position.y = 2.32;
  group.add(top);
  const apronMaterial = new THREE.MeshStandardMaterial({ color: '#4b2c18', roughness: 0.62, metalness: 0.03 });
  const frontApron = new THREE.Mesh(new RoundedBoxGeometry(11.2, 0.55, 0.2, 3, 0.05), apronMaterial);
  frontApron.position.set(0, 2.02, 7.15);
  const backApron = frontApron.clone();
  backApron.position.z = -7.15;
  const sideApron = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.55, 14.1, 3, 0.05), apronMaterial);
  sideApron.position.set(5.65, 2.02, 0);
  const otherSideApron = sideApron.clone();
  otherSideApron.position.x = -5.65;
  group.add(frontApron, backApron, sideApron, otherSideApron);

  const metal = new THREE.MeshStandardMaterial({ color: '#17191a', metalness: 0.8, roughness: 0.27 });
  for (const x of [-4.85, 4.85]) {
    for (const z of [-5.9, 5.9]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.27, 2.2, 0.27, 2, 0.05), metal);
      leg.position.set(x, 1.08, z);
      group.add(leg);
    }
  }
  const crossbar = new THREE.Mesh(new RoundedBoxGeometry(9.8, 0.16, 0.16, 2, 0.04), metal);
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
  addStrip(0.055, 13.8, 0, 0, accent);
  addStrip(11.1, 0.045, 0, 0, marking);
  addStrip(11.1, 0.045, 0, -6.85, marking);
  addStrip(11.1, 0.045, 0, 6.85, marking);
  addStrip(0.045, 13.75, -5.55, 0, marking);
  addStrip(0.045, 13.75, 5.55, 0, marking);

  for (const [x, z] of [[-4.6, 6.0], [4.6, -6.0]] as const) {
    const zone = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.53, 48), accent);
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
  readonly activePlayer: 0 | 1;
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
  setHitListener(listener: (intensity: number) => void): void;
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

  let blueWobble = 0;
  let redWobble = 0;
  let hitListener: (intensity: number) => void = () => undefined;

  const START_LAYOUTS: readonly {
    blue: { x: number; z: number; angle: number };
    red: { x: number; z: number; angle: number };
  }[] = [
    { blue: { x: -2.2, z: 4.7, angle: 1.08 }, red: { x: 2.2, z: -3.9, angle: -2.05 } },
    { blue: { x: 2.2, z: 4.8, angle: 2.05 }, red: { x: -2.2, z: -4.0, angle: -1.08 } },
    { blue: { x: -0.8, z: 5.1, angle: 1.57 }, red: { x: 0.8, z: -4.5, angle: -1.57 } },
    { blue: { x: -3.4, z: 4.2, angle: 0.92 }, red: { x: 3.4, z: -3.6, angle: -2.22 } },
    { blue: { x: 1.6, z: 4.5, angle: 1.75 }, red: { x: -1.4, z: -4.6, angle: -1.38 } },
  ];
  let roundIndex = 0;
  let currentServer: 0 | 1 = 0;

  function resetPenPositions(varied = true): void {
    const layout = (!varied || matchMode === 'practice')
      ? START_LAYOUTS[0]
      : START_LAYOUTS[roundIndex % START_LAYOUTS.length];

    blue.position.set(layout.blue.x, 2.62, layout.blue.z);
    red.position.set(layout.red.x, 2.64, layout.red.z);
    blue.rotation.set(0, layout.blue.angle, 0);
    red.rotation.set(0, layout.red.angle, 0);
    blueVelocity.set(0, 0);
    redVelocity.set(0, 0);
    blueAngularVelocity = 0;
    redAngularVelocity = 0;
    aimPower = 0;
    aimOrigin.copy(blue.position);
    aimOriginAngle = blue.rotation.y;
    aimActive = false;
    aimListener(0);
    aimLine.visible = false;
    aimHead.visible = false;
    shockwave.visible = false;
    shockwaveTimer = 0;
    impactStar.visible = false;
    starTimer = 0;
    for (const s of sparks) { s.active = false; s.mesh.visible = false; }
    blueWobble = 0;
    redWobble = 0;
  }

  function launchAi(time: number): void {
    const dx = blue.position.x - red.position.x;
    const dz = blue.position.z - red.position.z;
    const error = Math.sin(time * 0.0037) * 0.14;
    const angle = Math.atan2(-dz, dx) + error;
    const distance = Math.hypot(dx, dz);
    const strength = THREE.MathUtils.clamp(distance * 1.15 + 1.2, 4.2, 11.2);
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
    get activePlayer(): 0 | 1 { return turns.activePlayer; },
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
          roundIndex += 1;
          currentServer = currentServer === 0 ? 1 : 0;
          resetPenPositions(true);
          turns.finishPoint(currentServer);
          roundListener(null);
          turnListener(currentServer);
          actionListener(currentServer === 1 && matchMode === 'quick' ? 'aiWaiting' : 'ready');
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
        1.4, 0.16,
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

          const contactX = (blue.position.x + red.position.x) * 0.5;
          const contactZ = (blue.position.z + red.position.z) * 0.5;

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
          blueWobble = wobbleIntensity;
          redWobble = wobbleIntensity;

          playPenClackSound(relative);
          hitListener(relative);
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

      if (blueWobble > 0.001) {
        blue.position.y = 2.62 + Math.abs(Math.sin(time * 0.04)) * blueWobble;
        blue.rotation.z += Math.sin(time * 0.05) * blueWobble * 0.4;
        blueWobble = Math.max(0, blueWobble - delta * 0.85);
      } else {
        blue.position.y = 2.62;
        blue.rotation.z = 0;
      }
      if (redWobble > 0.001) {
        red.position.y = 2.64 + Math.abs(Math.cos(time * 0.042)) * redWobble;
        red.rotation.z -= Math.sin(time * 0.05) * redWobble * 0.4;
        redWobble = Math.max(0, redWobble - delta * 0.85);
      } else {
        red.position.y = 2.64;
        red.rotation.z = 0;
      }
      const blueOut = penHasFallen(blue.position.x, blue.position.z, blue.rotation.y, 1.4);
      const redOut = penHasFallen(red.position.x, red.position.z, red.rotation.y, 1.4);
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
      turns.finishPoint(0);
      resetPenPositions(false);
      turnRing.visible = true;
      roundListener(null);
      actionListener('ready');
    },
    canGrab(raycaster: THREE.Raycaster) {
      if (turns.phase !== 'player') return false;
      const pen = activeHumanPen();
      if (raycaster.intersectObject(pen, true).length > 0) return true;
      const scratch = new THREE.Vector3();
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -2.58);
      const hit = raycaster.ray.intersectPlane(plane, scratch);
      if (hit && Math.hypot(hit.x - pen.position.x, hit.z - pen.position.z) <= 3.8) {
        return true;
      }
      return false;
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
    setHitListener(listener: (intensity: number) => void) {
      hitListener = listener;
    },
    setMatchMode(mode: MatchMode) {
      matchMode = mode;
      roundIndex = 0;
      currentServer = 0;
      turns.begin(mode, 0);
      resetPenPositions(true);
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

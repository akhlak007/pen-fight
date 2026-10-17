import * as THREE from 'three';
import type { MatchMode } from '../app/app-state';
import type { ArenaAction } from '../game/solo-turn-controller';
import type { ArenaSnapshot } from '../network/protocol';
import { createClassroom, type ClassroomScene } from '../scene/classroom';

export class GameRenderer {
  readonly #renderer: THREE.WebGLRenderer;
  readonly #scene = new THREE.Scene();
  readonly #camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
  readonly #classroom: ClassroomScene;
  readonly #resizeObserver: ResizeObserver;
  #frame = 0;
  #reducedMotion = false;
  #target = new THREE.Vector3(0, 1.7, 0.5);
  readonly #timer = new THREE.Timer();
  readonly #raycaster = new THREE.Raycaster();
  readonly #tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -2.58);
  readonly #pointerNdc = new THREE.Vector2();
  readonly #tablePointScratch = new THREE.Vector3();
  #matchEnabled = false;
  #suspended = false;
  #localPlayer: number | null = null;
  #dragStart: { point: THREE.Vector3; pointerId: number } | null = null;
  #keyboardAim: { x: number; y: number } | null = null;
  #inputListener: ((action: 'aim' | 'flick' | 'cancel', x?: number, y?: number) => boolean | undefined) | null = null;
  #hitListener: ((intensity: number) => void) | null = null;
  #cameraTrauma = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.#renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = 0.92;
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = THREE.PCFShadowMap;
    this.#renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.#scene.background = new THREE.Color('#3f4633');
    this.#scene.fog = new THREE.FogExp2('#4c523c', 0.008);
    this.#classroom = createClassroom();
    this.#classroom.setHitListener((intensity) => {
      this.#hitShake(intensity);
      this.#hitListener?.(intensity);
    });
    this.#scene.add(this.#classroom.group);
    this.#addLights();
    this.focusRoom();
    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(canvas);
    this.#timer.connect(document);
    this.#resize();
    canvas.addEventListener('pointerdown', (event) => {
      if (!this.#matchEnabled || this.#suspended || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (this.#dragStart) this.#cancelDrag();
      if (this.#localPlayer !== null && this.#classroom.activePlayer !== this.#localPlayer) return;
      const point = this.#tablePoint(event.clientX, event.clientY);
      if (!point || !this.#classroom.canGrab(this.#raycaster)) return;
      this.#keyboardAim = null;
      this.#dragStart = { point: point.clone(), pointerId: event.pointerId };
      canvas.classList.add('is-aiming');
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Ignore if pointer capture fails on certain mobile webviews
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.#dragStart || event.pointerId !== this.#dragStart.pointerId || !this.#matchEnabled || this.#suspended) return;
      const point = this.#tablePoint(event.clientX, event.clientY);
      if (point) this.#aim(point.x - this.#dragStart.point.x, point.z - this.#dragStart.point.z);
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!this.#dragStart || event.pointerId !== this.#dragStart.pointerId) return;
      if (!this.#matchEnabled || this.#suspended) {
        this.#cancelDrag();
        return;
      }
      const point = this.#tablePoint(event.clientX, event.clientY);
      const distance = point ? point.distanceTo(this.#dragStart.point) : 0;
      if (point && distance >= 0.05) {
        const dx = point.x - this.#dragStart.point.x;
        const dz = point.z - this.#dragStart.point.z;
        this.#aim(dx, dz);
        this.#flick(dx, dz);
        this.#finishDrag();
      } else {
        this.#cancelDrag();
      }
    });
    canvas.addEventListener('pointercancel', (event) => {
      if (this.#dragStart && event.pointerId === this.#dragStart.pointerId) this.#cancelDrag();
    });
    canvas.addEventListener('keydown', (event) => {
      if (!this.#matchEnabled || this.#suspended) return;
      if (this.#localPlayer !== null && this.#classroom.activePlayer !== this.#localPlayer) return;
      const isTopSide = this.#classroom.activePlayer === 1 || this.#classroom.activePlayer === 2;
      const directions: Partial<Record<string, readonly [number, number]>> = isTopSide
        ? {
            ArrowLeft: [-1, 0],
            ArrowRight: [1, 0],
            ArrowUp: [0, -1],
            ArrowDown: [0, 1],
          }
        : {
            ArrowLeft: [1, 0],
            ArrowRight: [-1, 0],
            ArrowUp: [0, 1],
            ArrowDown: [0, -1],
          };
      const direction = directions[event.key];
      if (direction) {
        event.preventDefault();
        const previousLength = this.#keyboardAim ? Math.hypot(this.#keyboardAim.x, this.#keyboardAim.y) : 0.45;
        const nextLength = Math.min(2.4, previousLength + 0.3);
        const nextAim = { x: direction[0] * nextLength, y: direction[1] * nextLength };
        if (this.#aim(nextAim.x, nextAim.y)) {
          this.#keyboardAim = nextAim;
          canvas.classList.add('is-aiming');
        }
      } else if ((event.key === ' ' || event.key === 'Enter') && this.#keyboardAim) {
        event.preventDefault();
        this.#flick(this.#keyboardAim.x, this.#keyboardAim.y);
        this.#keyboardAim = null;
        canvas.classList.remove('is-aiming');
      } else if (event.key === 'Escape' && this.#keyboardAim) {
        event.preventDefault();
        this.#cancelAim();
        this.#keyboardAim = null;
        canvas.classList.remove('is-aiming');
      }
    });
  }

  start(): void {
    if (this.#frame) return;
    this.#renderer.setAnimationLoop((time) => {
      this.#timer.update(time);
      const delta = Math.min(this.#timer.getDelta(), 0.05);
      if (!this.#suspended) this.#classroom.update(time, delta, this.#reducedMotion);
      if (!this.#reducedMotion) {
        let shakeX = 0;
        let shakeY = 0;
        if (this.#cameraTrauma > 0.001) {
          const shake = this.#cameraTrauma * this.#cameraTrauma * 0.42;
          shakeX = Math.sin(time * 0.075) * shake;
          shakeY = Math.cos(time * 0.095) * shake * 0.5;
          this.#cameraTrauma = Math.max(0, this.#cameraTrauma - delta * 3.6);
        }
        const isP2 = this.#localPlayer === 1;
        const baseY = this.#matchEnabled ? 20.5 : 21;
        const baseZ = isP2 ? (this.#matchEnabled ? -17.5 : -18) : (this.#matchEnabled ? 18.5 : 19);
        const targetZ = isP2 ? 3.6 : -2.8;
        this.#camera.position.set(
          Math.sin(time * 0.00008) * 0.38 + shakeX,
          baseY + shakeY,
          baseZ,
        );
        this.#target.set(0, 1.8, targetZ);
        this.#camera.lookAt(this.#target);
      }
      this.#renderer.render(this.#scene, this.#camera);
    });
    this.#frame = 1;
  }

  setHitListener(listener: ((intensity: number) => void) | null): void { this.#hitListener = listener; }
  #hitShake(intensity: number): void {
    if (this.#reducedMotion) return;
    this.#cameraTrauma = Math.min(1.0, this.#cameraTrauma + THREE.MathUtils.clamp(intensity / 9, 0.25, 0.75));
  }

  setPlayerName(name: string): void { this.#classroom.updateBoard(name); }
  setBoardState(name: string, opponentName: string, score: readonly number[]): void {
    this.#classroom.updateBoard(name, opponentName, score);
  }
  setReducedMotion(value: boolean): void { this.#reducedMotion = value; }
  setPointListener(listener: (winner: number) => void): void { this.#classroom.setFallListener(listener); }
  setTurnListener(listener: (player: number) => void): void { this.#classroom.setTurnListener(listener); }
  setAimListener(listener: (power: number) => void): void { this.#classroom.setAimListener(listener); }
  setRoundListener(listener: (message: string | null) => void): void { this.#classroom.setRoundListener(listener); }
  setActionListener(listener: (action: ArenaAction) => void): void { this.#classroom.setActionListener(listener); }
  setMatchMode(mode: MatchMode, playerCount = 2, playerNames?: readonly string[]): void {
    this.#classroom.setMatchMode(mode, playerCount, playerNames);
  }
  setReplica(value: boolean): void { this.#classroom.setReplica(value); }
  setLocalPlayer(player: number | null): void {
    this.#localPlayer = player;
    if (this.#matchEnabled) this.focusArena();
  }
  setInputListener(listener: ((action: 'aim' | 'flick' | 'cancel', x?: number, y?: number) => boolean | undefined) | null): void { this.#inputListener = listener; }
  applyArenaSnapshot(snapshot: ArenaSnapshot): void { this.#classroom.applyArenaSnapshot(snapshot); }
  getArenaSnapshot(seq: number, score: readonly number[]): ArenaSnapshot { return this.#classroom.getArenaSnapshot(seq, score); }
  remoteInput(action: 'aim' | 'flick' | 'cancel', x?: number, y?: number): void {
    if (action === 'aim' && x !== undefined && y !== undefined) this.#classroom.aim(x, y);
    else if (action === 'flick') {
      if (x !== undefined && y !== undefined) this.#classroom.aim(x, y);
      this.#classroom.flick();
    }
    else if (action === 'cancel') this.#classroom.cancelAim();
  }
  isPenMoving(): boolean { return this.#classroom.isPenMoving?.() ?? true; }
  setSuspended(value: boolean): void {
    this.#suspended = value;
    if (value) this.#cancelDrag();
  }
  setMatchEnabled(value: boolean): void {
    this.#matchEnabled = value;
    this.canvas.style.cursor = value ? 'grab' : 'default';
    if (!value) {
      this.#cancelDrag();
      this.#classroom.resetPens();
    }
  }

  focusArena(): void {
    if (this.#localPlayer === 1) {
      this.#camera.position.set(0, 20.5, -17.5);
      this.#target.set(0, 1.8, 3.6);
      this.#camera.lookAt(this.#target);
    } else {
      this.#camera.position.set(0, 20.5, 18.5);
      this.#target.set(0, 1.8, -2.8);
      this.#camera.lookAt(this.#target);
    }
  }

  focusRoom(): void {
    this.#camera.position.set(0, 21, 19);
    this.#target.set(0, 1.7, -4);
    this.#camera.lookAt(this.#target);
  }

  #addLights(): void {
    this.#scene.add(new THREE.HemisphereLight('#dce5dc', '#4a3520', 1.15));
    const sun = new THREE.DirectionalLight('#ffe8bd', 3.35);
    sun.position.set(-9, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 18;
    sun.shadow.camera.bottom = -18;
    sun.shadow.bias = -0.0002;
    this.#scene.add(sun);
    const boardGlow = new THREE.SpotLight('#dfffc5', 55, 30, 0.65, 0.7, 1.3);
    boardGlow.position.set(0, 13, -7);
    boardGlow.target.position.set(0, 6, -15);
    this.#scene.add(boardGlow, boardGlow.target);
  }

  #resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.fov = width / height < 0.8 ? 58 : 40;
    this.#camera.updateProjectionMatrix();
  }

  #tablePoint(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    this.#pointerNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.#raycaster.setFromCamera(this.#pointerNdc, this.#camera);
    return this.#raycaster.ray.intersectPlane(this.#tablePlane, this.#tablePointScratch);
  }

  #finishDrag(): void {
    const pointerId = this.#dragStart?.pointerId;
    this.#dragStart = null;
    this.canvas.classList.remove('is-aiming');
    if (pointerId !== undefined) {
      try {
        if (this.canvas.hasPointerCapture(pointerId)) this.canvas.releasePointerCapture(pointerId);
      } catch {
        // Pointer might already be released
      }
    }
  }

  #cancelDrag(): void {
    if (this.#dragStart || this.#keyboardAim) this.#cancelAim();
    this.#keyboardAim = null;
    this.#finishDrag();
  }

  #aim(x: number, y: number): boolean { return this.#inputListener?.('aim', x, y) ?? this.#classroom.aim(x, y); }
  #flick(x?: number, y?: number): boolean { return this.#inputListener?.('flick', x, y) ?? this.#classroom.flick(); }
  #cancelAim(): void { if (!this.#inputListener?.('cancel')) this.#classroom.cancelAim(); }
}

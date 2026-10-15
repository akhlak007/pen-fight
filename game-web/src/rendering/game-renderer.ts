import * as THREE from 'three';
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
  #matchEnabled = false;
  #dragStart: { x: number; y: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.#renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.#renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.#renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.#renderer.toneMappingExposure = 1.1;
    this.#renderer.shadowMap.enabled = true;
    this.#renderer.shadowMap.type = THREE.PCFShadowMap;
    this.#renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.#scene.background = new THREE.Color('#46503a');
    this.#scene.fog = new THREE.FogExp2('#555c43', 0.012);
    this.#classroom = createClassroom();
    this.#scene.add(this.#classroom.group);
    this.#addLights();
    this.#camera.position.set(0, 23, 27);
    this.#camera.lookAt(this.#target);
    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(canvas);
    this.#timer.connect(document);
    this.#resize();
    canvas.addEventListener('pointerdown', (event) => {
      if (!this.#matchEnabled) return;
      const rect = canvas.getBoundingClientRect();
      this.#raycaster.setFromCamera(new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ), this.#camera);
      if (!this.#classroom.canGrab(this.#raycaster)) return;
      this.#dragStart = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!this.#dragStart || !this.#matchEnabled) return;
      this.#classroom.aim(event.clientX - this.#dragStart.x, event.clientY - this.#dragStart.y);
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!this.#dragStart || !this.#matchEnabled) return;
      const distance = Math.hypot(event.clientX - this.#dragStart.x, event.clientY - this.#dragStart.y);
      if (distance >= 16) this.#classroom.flick(distance * 0.0018);
      this.#dragStart = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointercancel', (event) => {
      this.#dragStart = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    });
  }

  start(): void {
    if (this.#frame) return;
    this.#renderer.setAnimationLoop((time) => {
      this.#timer.update(time);
      this.#classroom.update(time, Math.min(this.#timer.getDelta(), 0.05), this.#reducedMotion);
      if (!this.#reducedMotion) {
        this.#camera.position.x = Math.sin(time * 0.00008) * 0.38;
        this.#camera.lookAt(this.#target);
      }
      this.#renderer.render(this.#scene, this.#camera);
    });
    this.#frame = 1;
  }

  setPlayerName(name: string): void { this.#classroom.updateBoard(name); }
  setReducedMotion(value: boolean): void { this.#reducedMotion = value; }
  setPointListener(listener: (winner: 0 | 1) => void): void { this.#classroom.setFallListener(listener); }
  setMatchEnabled(value: boolean): void {
    this.#matchEnabled = value;
    this.canvas.style.cursor = value ? 'grab' : 'default';
    if (!value) this.#classroom.resetPens();
  }

  focusArena(): void {
    this.#camera.position.set(0, 14.5, 17.5);
    this.#target.set(0, 2, 1.5);
    this.#camera.lookAt(this.#target);
  }

  focusRoom(): void {
    this.#camera.position.set(0, 23, 27);
    this.#target.set(0, 1.7, 0.5);
    this.#camera.lookAt(this.#target);
  }

  #addLights(): void {
    this.#scene.add(new THREE.HemisphereLight('#dce9ff', '#574024', 1.45));
    const sun = new THREE.DirectionalLight('#fff3cf', 4.1);
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
    this.#camera.fov = width / height < 0.8 ? 55 : 39;
    this.#camera.updateProjectionMatrix();
  }
}

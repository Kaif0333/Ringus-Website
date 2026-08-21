/**
 * RingScene — renderer, lighting, interaction (drag + scroll spin), DOM
 * hotspot projection, visibility-aware rendering, and WebXR (VR / AR).
 * Loaded lazily by sections/product.ts so Three.js never blocks first paint.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildRing, type AnchorName, type RingParts } from './ring';

export type XRMode = 'immersive-vr' | 'immersive-ar';

export interface RingSceneOptions {
  hotspots: Partial<Record<AnchorName, HTMLElement>>;
  reducedMotion: boolean;
}

const BASE_TILT_X = 0.92;
const BASE_TILT_Z = 0.18;
const SCROLL_TURNS = 1.5;

export class RingScene {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly ring: RingParts;
  private lastFrameAt = 0;
  private readonly pmrem: THREE.PMREMGenerator;

  private readonly hotspotEls: Partial<Record<AnchorName, HTMLElement>>;
  private readonly hotspotState: Record<AnchorName, boolean> = { sensor: false, shell: false, cell: false };

  private targetSpin = 0;
  private spin = 0;
  private idle = 0;
  private dragX = 0;
  private dragY = 0;
  private velX = 0;
  private velY = 0;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };

  private running = false;
  private xrActive = false;
  private disposed = false;
  private readonly reducedMotion: boolean;

  private readonly resizeObserver: ResizeObserver;
  private readonly onVisibility = (): void => {
    if (document.hidden) this.stop();
    else if (this.wantsRun) this.start();
  };
  private wantsRun = false;

  // scratch
  private readonly v3 = new THREE.Vector3();
  private readonly n3 = new THREE.Vector3();
  private readonly camDir = new THREE.Vector3();
  private readonly normalMatrix = new THREE.Matrix3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly stage: HTMLElement,
    opts: RingSceneOptions,
  ) {
    this.hotspotEls = opts.hotspots;
    this.reducedMotion = opts.reducedMotion;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.xr.enabled = true;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    this.camera.position.set(0, 0.42, 4.4);
    this.camera.lookAt(0, 0, 0);

    /* environment + lights */
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 3);
    const rim = new THREE.DirectionalLight(0xb8f26b, 1.1);
    rim.position.set(-4, 1.5, -3);
    const fill = new THREE.DirectionalLight(0x9fb4ff, 0.5);
    fill.position.set(-2, -1, 4);
    const ambient = new THREE.AmbientLight(0xffffff, 0.18);
    this.scene.add(key, rim, fill, ambient);

    /* ring */
    this.ring = buildRing();
    this.ring.group.rotation.set(BASE_TILT_X, 0, BASE_TILT_Z);
    this.scene.add(this.ring.group);

    /* interaction */
    this.bindPointer();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(stage);
    this.resize();

    document.addEventListener('visibilitychange', this.onVisibility);

    this.renderFrame(0);   // first frame before the loop starts
  }

  /* -- public --------------------------------------------------------------- */

  static supported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  }

  setScrollProgress(p: number): void {
    this.targetSpin = this.reducedMotion ? 0 : p * Math.PI * 2 * SCROLL_TURNS;
  }

  start(): void {
    this.wantsRun = true;
    if (this.running || this.disposed) return;
    this.running = true;
    this.lastFrameAt = 0;
    this.renderer.setAnimationLoop((t) => this.renderFrame(t));
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (!this.xrActive) this.renderer.setAnimationLoop(null);
  }

  pauseWanted(): void {
    this.wantsRun = false;
    this.stop();
  }

  async xrSupported(mode: XRMode): Promise<boolean> {
    const xr = navigator.xr;
    if (!xr) return false;
    try {
      return await xr.isSessionSupported(mode);
    } catch {
      return false;
    }
  }

  async enterXR(mode: XRMode): Promise<void> {
    const xr = navigator.xr;
    if (!xr || this.xrActive) return;

    const init: XRSessionInit = mode === 'immersive-vr'
      ? { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] }
      : { optionalFeatures: ['local-floor', 'dom-overlay'] };

    const session = await xr.requestSession(mode, init);
    this.renderer.xr.setReferenceSpaceType('local-floor');
    await this.renderer.xr.setSession(session);

    this.xrActive = true;
    const saved = {
      position: this.ring.group.position.clone(),
      scale: this.ring.group.scale.clone(),
    };
    // Place the ring at chest height, just in front of the viewer.
    this.ring.group.position.set(0, 1.35, -0.7);
    this.ring.group.scale.setScalar(mode === 'immersive-ar' ? 0.12 : 0.16);
    this.start();

    session.addEventListener('end', () => {
      this.xrActive = false;
      this.ring.group.position.copy(saved.position);
      this.ring.group.scale.copy(saved.scale);
      this.resize();
      if (!this.wantsRun) this.stop();
    }, { once: true });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.ring.dispose();
    this.scene.environment?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }

  /* -- internals ----------------------------------------------------------- */

  private resize(): void {
    const rect = this.stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    // Keep the ring filling the stage on narrow screens.
    const fit = Math.min(1, w / 520);
    const s = 0.82 + 0.18 * fit;
    if (!this.xrActive) this.ring.group.scale.setScalar(s);

    if (!this.running) this.renderFrame(0);
  }

  private bindPointer(): void {
    const c = this.canvas;
    c.style.touchAction = 'pan-y';

    c.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.velX = 0;
      this.velY = 0;
      c.setPointerCapture(e.pointerId);
      c.classList.add('is-grabbing');
    });

    c.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.lastPointer.x;
      const dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.velX = dx * 0.0085;
      this.velY = dy * 0.0055;
      this.dragX += this.velX;
      this.dragY = THREE.MathUtils.clamp(this.dragY + this.velY, -0.7, 0.7);
      if (!this.running) this.renderFrame(0);
    });

    const release = (): void => {
      this.dragging = false;
      c.classList.remove('is-grabbing');
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
    c.addEventListener('lostpointercapture', release);
  }

  private renderFrame(t: number): void {
    if (this.disposed) return;
    const now = t || performance.now();
    const dt = this.lastFrameAt ? Math.min(0.05, (now - this.lastFrameAt) / 1000) : 0;
    this.lastFrameAt = now;

    // Ease toward the scroll-driven spin; keep a slow idle turn.
    this.spin += (this.targetSpin - this.spin) * Math.min(1, dt * 4.5);
    if (!this.reducedMotion && !this.dragging) this.idle += dt * 0.22;

    if (!this.dragging) {
      this.dragX += this.velX;
      this.dragY = THREE.MathUtils.clamp(this.dragY + this.velY, -0.7, 0.7);
      this.velX *= 0.92;
      this.velY *= 0.9;
      // drift the vertical tilt back toward rest
      this.dragY += (0 - this.dragY) * Math.min(1, dt * 1.8);
    }

    const g = this.ring.group;
    g.rotation.y = this.spin + this.idle + this.dragX;
    g.rotation.x = BASE_TILT_X + this.dragY;

    this.renderer.render(this.scene, this.camera);
    if (!this.xrActive) this.projectHotspots();
  }

  private projectHotspots(): void {
    const g = this.ring.group;
    g.updateMatrixWorld();
    this.normalMatrix.getNormalMatrix(g.matrixWorld);
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    (Object.keys(this.ring.anchors) as AnchorName[]).forEach((name) => {
      const el = this.hotspotEls[name];
      if (!el) return;
      const anchor = this.ring.anchors[name];

      this.v3.copy(anchor.position).applyMatrix4(g.matrixWorld);
      this.n3.copy(anchor.normal).applyMatrix3(this.normalMatrix).normalize();
      this.camDir.copy(this.camera.position).sub(this.v3).normalize();
      const facing = this.n3.dot(this.camDir);

      const on = facing > 0.28;
      if (on !== this.hotspotState[name]) {
        this.hotspotState[name] = on;
        el.classList.toggle('is-on', on);
        // Reflect which callouts are showing on the stage (useful for tests/CSS).
        this.stage.dataset.hotspots = (Object.keys(this.hotspotState) as AnchorName[])
          .filter((k) => this.hotspotState[k]).join(' ');
      }
      if (!on) return;

      this.v3.project(this.camera);
      const x = (this.v3.x * 0.5 + 0.5) * width;
      const y = (-this.v3.y * 0.5 + 0.5) * height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    });
  }
}

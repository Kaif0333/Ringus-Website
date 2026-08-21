/**
 * Product section: lazily boots the Three.js ring when the section nears the
 * viewport, wires scroll-driven spin, visibility-aware rendering, XR buttons,
 * and falls back to a photograph when WebGL is unavailable.
 */

import { ScrollTrigger, reducedMotion } from '../lib/motion';
import type { AnchorName } from '../three/ring';
import type { RingScene, XRMode } from '../three/scene';

export function initProduct(): void {
  const section = document.querySelector<HTMLElement>('#product');
  const stage = section?.querySelector<HTMLElement>('[data-ring-stage]') ?? null;
  const canvas = stage?.querySelector<HTMLCanvasElement>('[data-ring-canvas]') ?? null;
  const fallback = stage?.querySelector<HTMLElement>('[data-ring-fallback]') ?? null;
  const hint = section?.querySelector<HTMLElement>('[data-ring-hint]') ?? null;
  const xrButtons = Array.from(section?.querySelectorAll<HTMLButtonElement>('[data-xr]') ?? []);

  if (!section || !stage || !canvas) return;

  const showFallback = (): void => {
    canvas.hidden = true;
    if (fallback) fallback.hidden = false;
    if (hint) hint.textContent = 'Pictured: the Ringus ring';
    stage.classList.add('is-fallback');
  };

  const webglOK = ((): boolean => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  })();

  if (!webglOK) {
    showFallback();
    return;
  }

  const hotspots: Partial<Record<AnchorName, HTMLElement>> = {};
  stage.querySelectorAll<HTMLElement>('[data-hotspot]').forEach((el) => {
    const name = el.dataset.hotspot as AnchorName | undefined;
    if (name) hotspots[name] = el;
  });

  let scene: RingScene | null = null;

  const boot = async (): Promise<void> => {
    try {
      const mod = await import('../three/scene');
      scene = new mod.RingScene(canvas, stage, { hotspots, reducedMotion: reducedMotion() });
      stage.classList.add('is-ready');
    } catch {
      showFallback();
      return;
    }

    const s = scene;

    // Render only while the stage is on screen.
    new IntersectionObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      if (e.isIntersecting) s.start();
      else s.pauseWanted();
    }, { threshold: 0.05 }).observe(stage);

    // Scroll-driven spin across the section's travel.
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => s.setScrollProgress(self.progress),
    });

    // WebXR: only offer what this device can actually do.
    xrButtons.forEach((btn) => {
      const mode = btn.dataset.xr === 'ar' ? 'immersive-ar' : 'immersive-vr';
      void s.xrSupported(mode as XRMode).then((ok) => {
        btn.hidden = !ok;
        if (!ok) return;
        btn.addEventListener('click', () => {
          btn.disabled = true;
          s.enterXR(mode as XRMode)
            .catch(() => { /* user cancelled or device refused */ })
            .finally(() => { btn.disabled = false; });
        });
      });
    });

    window.addEventListener('pagehide', () => s.dispose(), { once: true });
  };

  // Load Three.js only when the section is within a viewport of coming on
  // screen — and never during the hero entrance: compiling the environment
  // map and shaders costs real main-thread time on weak GPUs, so wait for the
  // preloader to lift and the browser to go idle first.
  const watch = (): void => {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void boot();
        }
      }, { rootMargin: '100% 0px' });
      io.observe(stage);
    } else {
      void boot();
    }
  };

  const whenIdle = (): void => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(watch, { timeout: 1500 });
    } else {
      window.setTimeout(watch, 300);
    }
  };

  if (document.documentElement.classList.contains('is-loading')) {
    document.addEventListener('preloader:done', whenIdle, { once: true });
  } else {
    whenIdle();
  }
}

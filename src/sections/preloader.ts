/**
 * Preloader — a short, honest progress indicator while fonts and the hero
 * video's first frame arrive. Hard-capped so it never holds the page hostage.
 * Skipped outright under reduced motion.
 */

import { gsap, reducedMotion } from '../lib/motion';

export interface PreloaderHandle {
  /** Resolves when the overlay begins to lift (hero entrance may start). */
  ready(): Promise<void>;
}

const HARD_CAP_MS = 1800;
const MIN_SHOW_MS = 650;

export function initPreloader(): PreloaderHandle {
  const root = document.documentElement;
  const el = document.querySelector<HTMLElement>('[data-preloader]');
  const pct = el?.querySelector<HTMLElement>('[data-preloader-pct]');

  if (!el || !pct || reducedMotion()) {
    el?.remove();
    return { ready: () => Promise.resolve() };
  }

  root.classList.add('is-loading');

  const started = performance.now();
  const state = { v: 0 };
  let target = 0;
  let done = false;

  const paint = (): void => { pct.textContent = String(Math.round(state.v)); };
  const advance = (to: number): void => {
    target = Math.max(target, Math.min(100, to));
    gsap.to(state, { v: target, duration: 0.6, ease: 'power2.out', onUpdate: paint, overwrite: true });
  };

  // Weighted signals; each adds its share when it lands.
  const signals: Array<Promise<unknown>> = [];
  const weightFonts = 30;
  const weightVideo = 45;
  const weightLoad = 25;

  let progress = 0;
  const bump = (w: number): void => { progress += w; advance(progress); };

  if ('fonts' in document) {
    signals.push(document.fonts.ready.then(() => bump(weightFonts)));
  } else {
    bump(weightFonts);
  }

  const video = document.querySelector<HTMLVideoElement>('[data-hero-video] video');
  if (video) {
    signals.push(new Promise<void>((resolve) => {
      if (video.readyState >= 2) { bump(weightVideo); resolve(); return; }
      const onReady = (): void => { bump(weightVideo); resolve(); };
      video.addEventListener('loadeddata', onReady, { once: true });
      video.addEventListener('error', onReady, { once: true });
    }));
  } else {
    bump(weightVideo);
  }

  signals.push(new Promise<void>((resolve) => {
    if (document.readyState === 'complete') { bump(weightLoad); resolve(); return; }
    window.addEventListener('load', () => { bump(weightLoad); resolve(); }, { once: true });
  }));

  // Gentle idle creep so the number never looks stuck.
  const creep = window.setInterval(() => {
    if (target < 88) advance(target + 3);
  }, 220);

  const readyPromise = new Promise<void>((resolve) => {
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      root.classList.remove('is-loading');
      document.dispatchEvent(new CustomEvent('preloader:done'));
      resolve();
    };

    const finish = (): void => {
      if (done) return;
      done = true;
      window.clearInterval(creep);

      const elapsed = performance.now() - started;
      const wait = Math.max(0, MIN_SHOW_MS - elapsed);

      gsap.timeline({ delay: wait / 1000 })
        .to(state, { v: 100, duration: 0.35, ease: 'power2.out', onUpdate: paint })
        .add(release)
        .to(el, { yPercent: -100, duration: 0.85, ease: 'expo.inOut' }, '<0.05')
        .add(() => { el.remove(); });

      // The exit above rides GSAP's ticker, which browsers throttle in
      // background tabs. Never let that hold the page: unlock it on a plain
      // timer regardless, and drop the overlay shortly after.
      window.setTimeout(release, wait + 600);
      window.setTimeout(() => { el.remove(); }, wait + 1800);
    };

    Promise.all(signals).then(finish, finish);
    window.setTimeout(finish, HARD_CAP_MS);
  });

  return { ready: () => readyPromise };
}

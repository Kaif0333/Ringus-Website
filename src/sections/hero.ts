/**
 * Hero: background video (ping-pong engine), WCAG pause control, headline
 * word reveal, entrance timeline, live sample card, scroll cue, parallax.
 */

import { gsap, ScrollTrigger, motionOK, reducedMotion } from '../lib/motion';
import { DEFAULTS, createPingPongLoop, holdStill, type PingPongHandle } from '../lib/pingpong';

/* -- background video ------------------------------------------------------ */

function initVideo(): void {
  const stage = document.querySelector<HTMLElement>('[data-hero-video]');
  const video = stage?.querySelector('video') ?? null;
  const canvas = stage?.querySelector('canvas') ?? null;
  const toggle = document.querySelector<HTMLButtonElement>('[data-video-toggle]');

  if (!stage || !video || !canvas) {
    if (toggle) toggle.hidden = true;
    return;
  }

  const reduced = reducedMotion();
  const canEngine = typeof window.createImageBitmap === 'function';

  let engine: PingPongHandle | null = null;
  let running: boolean;

  const paint = (): void => {
    if (!toggle) return;
    const label = toggle.querySelector<HTMLElement>('[data-toggle-label]');
    const pauseIcon = toggle.querySelector<HTMLElement>('[data-toggle-icon="pause"]');
    const playIcon = toggle.querySelector<HTMLElement>('[data-toggle-icon="play"]');
    if (label) label.textContent = running ? 'Pause background video' : 'Play background video';
    if (pauseIcon) pauseIcon.hidden = !running;
    if (playIcon) playIcon.hidden = running;
    toggle.setAttribute('aria-pressed', String(!running));
  };

  if (reduced) {
    holdStill(video);
    running = false;
  } else if (canEngine) {
    engine = createPingPongLoop(stage, video, canvas, DEFAULTS);
    running = true;
  } else {
    running = true;
  }
  paint();

  toggle?.addEventListener('click', () => {
    if (running) {
      if (engine) engine.pause();
      else video.pause();
      running = false;
    } else {
      if (canEngine && !engine) {
        video.autoplay = true;
        engine = createPingPongLoop(stage, video, canvas, DEFAULTS);
      } else if (engine) {
        engine.resume();
      } else {
        video.loop = true;
        video.play().catch(() => { /* blocked; user can retry */ });
      }
      running = true;
    }
    paint();
  });

  // Pause the engine entirely while the hero is off-screen (saves decode + GPU),
  // and fade the control out since it only applies to the hero.
  if ('IntersectionObserver' in window) {
    let offscreenPaused = false;
    new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      document.documentElement.classList.toggle('hero-passed', !entry.isIntersecting);
      if (!engine) return;
      if (!entry.isIntersecting && running) {
        engine.pause();
        offscreenPaused = true;
      } else if (entry.isIntersecting && offscreenPaused) {
        engine.resume();
        offscreenPaused = false;
      }
    }, { threshold: 0.02 }).observe(stage);
  }
}

/* -- live sample card ------------------------------------------------------ */

function initLiveCard(): void {
  const clock = document.querySelector<HTMLElement>('[data-clock]');
  const hr = document.querySelector<HTMLElement>('[data-hr]');
  const spo2 = document.querySelector<HTMLElement>('[data-spo2]');

  const tick = (): void => {
    if (clock) {
      const d = new Date();
      clock.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  };
  tick();
  window.setInterval(tick, 15_000);

  if (reducedMotion()) return;

  let beat = 62;
  let sat = 98;
  window.setInterval(() => {
    beat = Math.max(58, Math.min(66, beat + (Math.random() < 0.5 ? -1 : 1)));
    sat = Math.random() < 0.15 ? (sat === 98 ? 97 : 98) : sat;
    if (hr) hr.textContent = String(beat);
    if (spo2) spo2.textContent = String(sat);
  }, 3000);
}

/* -- entrance + parallax --------------------------------------------------- */

function initEntrance(): void {
  const hero = document.querySelector<HTMLElement>('#hero');
  if (!hero) return;

  const words = Array.from(hero.querySelectorAll<HTMLElement>('.word__in'));
  const items = Array.from(hero.querySelectorAll<HTMLElement>('[data-hero-in]'));
  const aside = hero.querySelector<HTMLElement>('.hero__aside');
  const cue = hero.querySelector<HTMLElement>('.hero__scroll');
  const watermark = hero.querySelector<HTMLElement>('.hero__watermark');

  if (!motionOK()) return;   // everything stays in its natural, visible state

  gsap.set(words, { yPercent: 112 });
  gsap.set(items, { autoAlpha: 0, y: 22 });
  if (aside) gsap.set(aside, { autoAlpha: 0, y: 28, scale: 0.96 });
  if (cue) gsap.set(cue, { autoAlpha: 0 });
  if (watermark) gsap.set(watermark, { autoAlpha: 0, y: 40 });

  const play = (): void => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(words, { yPercent: 0, duration: 1.15, stagger: 0.085 }, 0.15)
      .to(items, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.09 }, 0.45)
      .to(aside, { autoAlpha: 1, y: 0, scale: 1, duration: 1.05 }, 0.55)
      .to(watermark, { autoAlpha: 1, y: 0, duration: 1.4 }, 0.9)
      .to(cue, { autoAlpha: 1, duration: 0.8 }, 1.3);
  };

  // Start once the preloader lifts (it dispatches this), or immediately if absent.
  if (document.documentElement.classList.contains('is-loading')) {
    document.addEventListener('preloader:done', play, { once: true });
  } else {
    play();
  }

  // Subtle parallax as the hero scrolls away.
  const copy = hero.querySelector<HTMLElement>('.hero__copy');
  gsap.to([copy, aside].filter(Boolean), {
    y: -60,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  });
  if (watermark) {
    gsap.to(watermark, {
      y: 120,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  // Hide the scroll cue after the first real scroll.
  if (cue) {
    ScrollTrigger.create({
      trigger: hero,
      start: '8% top',
      onEnter: () => gsap.to(cue, { autoAlpha: 0, duration: 0.4 }),
      onLeaveBack: () => gsap.to(cue, { autoAlpha: 1, duration: 0.4 }),
    });
  }
}

export function initHero(): void {
  initVideo();
  initLiveCard();
  initEntrance();
}

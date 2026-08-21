/**
 * 06 · Proof — testimonial carousel.
 *
 * Progressive: before this runs the track is a native scroll-snap strip.
 * Once `.is-js` is on the root the viewport clips and the track is translated
 * with GSAP (or set instantly under reduced motion).
 *
 * Autoplay runs only when motion is OK, only while the carousel is on screen
 * and the tab is visible, pauses on hover / focus-within, and stops for good
 * the first time the user drives it themselves.
 */

import { gsap, ScrollTrigger, motionOK } from '../lib/motion';

const AUTOPLAY_MS = 6500;
const SWIPE_PX = 40;

export function initProof(): void {
  const root = document.querySelector<HTMLElement>('.proof [data-carousel]');
  if (!root) return;

  const viewport = root.querySelector<HTMLElement>('[data-carousel-viewport]');
  const track = root.querySelector<HTMLElement>('[data-carousel-track]');
  const dotsHost = root.querySelector<HTMLElement>('[data-carousel-dots]');
  const prev = root.querySelector<HTMLButtonElement>('[data-carousel-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-carousel-next]');
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-carousel-slide]'));
  if (!viewport || !track || !dotsHost || !prev || !next || slides.length === 0) return;

  const count = slides.length;
  const animate = motionOK();
  let index = 0;

  root.classList.add('is-js');

  /* -- dots ---------------------------------------------------------------- */

  const dots: HTMLButtonElement[] = slides.map((slide, i) => {
    // Each slide is the tabpanel its dot controls (APG tabbed carousel).
    slide.id ||= `proof-slide-${i + 1}`;
    slide.setAttribute('role', 'tabpanel');
    slide.setAttribute('aria-roledescription', 'slide');
    slide.setAttribute('aria-label', `${i + 1} of ${count}`);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'proof__dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Testimonial ${i + 1} of ${count}`);
    dot.setAttribute('aria-controls', slide.id);
    dotsHost.append(dot);
    return dot;
  });

  /* -- state --------------------------------------------------------------- */

  const render = (): void => {
    slides.forEach((slide, i) => {
      if (i === index) slide.removeAttribute('aria-hidden');
      else slide.setAttribute('aria-hidden', 'true');
    });
    dots.forEach((dot, i) => {
      const on = i === index;
      dot.setAttribute('aria-selected', on ? 'true' : 'false');
      dot.tabIndex = on ? 0 : -1;
    });
  };

  const go = (to: number): void => {
    const target = ((to % count) + count) % count;
    if (target === index) return;
    index = target;
    render();

    const xPercent = -index * 100;
    if (!animate) {
      gsap.set(track, { xPercent });
      return;
    }

    gsap.to(track, { xPercent, duration: 0.7, ease: 'expo.out', overwrite: 'auto' });

    // The one motion detail: the incoming quote settles into place a beat
    // after the card arrives. Children are queried fresh because the global
    // icon pass swaps the <i> quote mark for an <svg>.
    const slide = slides[index];
    if (!slide) return;
    const parts = Array.from(slide.children);
    gsap.killTweensOf(parts);
    gsap.fromTo(
      parts,
      { y: 14, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.07,
        delay: 0.1,
        clearProps: 'transform,opacity',
      },
    );
  };

  render();

  /* -- autoplay ------------------------------------------------------------ */

  let timer: number | null = null;
  let stopped = !animate;
  let hovered = false;
  let focused = false;
  let inView = false;
  let pageVisible = document.visibilityState !== 'hidden';

  const sync = (): void => {
    const run = !stopped && !hovered && !focused && inView && pageVisible;
    if (run && timer === null) {
      timer = window.setInterval(() => go(index + 1), AUTOPLAY_MS);
    } else if (!run && timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    // APG: a rotating carousel must not announce; go polite only once it stops.
    viewport.setAttribute('aria-live', timer === null ? 'polite' : 'off');
  };

  const userDidInteract = (): void => {
    stopped = true;
    sync();
  };

  if (animate) {
    const trigger = ScrollTrigger.create({
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        inView = self.isActive;
        sync();
      },
    });
    inView = trigger.isActive;

    root.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovered = true;
      sync();
    });
    root.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'mouse') return;
      hovered = false;
      sync();
    });
    root.addEventListener('focusin', () => {
      focused = true;
      sync();
    });
    root.addEventListener('focusout', (e) => {
      if (e.relatedTarget instanceof Node && root.contains(e.relatedTarget)) return;
      focused = false;
      sync();
    });
    document.addEventListener('visibilitychange', () => {
      pageVisible = document.visibilityState !== 'hidden';
      sync();
    });

    sync();
  }

  /* -- controls ------------------------------------------------------------ */

  prev.addEventListener('click', () => {
    userDidInteract();
    go(index - 1);
  });
  next.addEventListener('click', () => {
    userDidInteract();
    go(index + 1);
  });
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      userDidInteract();
      go(i);
    });
  });

  /* -- keyboard (focus anywhere inside the carousel) ----------------------- */

  root.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const onDot = dots.some((dot) => dot === document.activeElement);

    let target: number;
    switch (e.key) {
      case 'ArrowRight':
        target = index + 1;
        break;
      case 'ArrowLeft':
        target = index - 1;
        break;
      case 'Home':
        if (!onDot) return;
        target = 0;
        break;
      case 'End':
        if (!onDot) return;
        target = count - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    userDidInteract();
    go(target);
    // Roving tabindex: keep focus on the selected tab when arrowing on a dot.
    if (onDot) dots[index]?.focus({ preventScroll: true });
  });

  /* -- pointer swipe (horizontal only, 40px threshold) --------------------- */

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;

  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    viewport.setPointerCapture(e.pointerId);
  });

  viewport.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return;
    userDidInteract();
    go(index + (dx < 0 ? 1 : -1));
  });

  viewport.addEventListener('pointercancel', () => {
    pointerId = null;
  });
}

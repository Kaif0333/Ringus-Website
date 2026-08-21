/**
 * Motion utilities: GSAP + ScrollTrigger registration, reduced-motion gate,
 * scroll reveals, count-ups, and pointer spotlight.
 *
 * Never-hidden guarantee: the hidden from-state of `[data-reveal]` lives under
 * `html.motion`, which `initReveals` adds only when it is about to reveal. With
 * JS blocked, reduced motion, or no IntersectionObserver, nothing is hidden.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export const reducedMotion = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const finePointer = (): boolean =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export const motionOK = (): boolean =>
  !reducedMotion() && 'IntersectionObserver' in window;

/* -- reveals --------------------------------------------------------------- */

export function initReveals(): void {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
  if (!els.length) return;

  if (!motionOK()) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }

  document.documentElement.classList.add('motion');

  const reveal = (el: HTMLElement): void => el.classList.add('is-in');

  ScrollTrigger.batch(els, {
    start: 'top 90%',
    once: true,
    interval: 0.08,
    batchMax: 8,
    onEnter: (batch) => {
      (batch as HTMLElement[]).forEach((el, i) => {
        const delay = Number(el.dataset.revealDelay ?? 0) + i * 70;
        window.setTimeout(() => reveal(el), delay);
      });
    },
  });

  // Anything within a viewport-height of the document end can never clear a
  // "top 90%" gate; sweep it in when the page bottoms out.
  const sweep = (): void => {
    const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (!atEnd) return;
    els.forEach(reveal);
    window.removeEventListener('scroll', sweep);
  };
  window.addEventListener('scroll', sweep, { passive: true });
}

/* -- counters -------------------------------------------------------------- */

function formatNumber(value: number, decimals: number, sep: boolean): string {
  const fixed = value.toFixed(decimals);
  if (!sep) return fixed;
  const [int = '', frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

export function initCounters(): void {
  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-count]'));
  if (!els.length) return;

  els.forEach((el) => {
    const to = Number(el.dataset.count);
    const from = Number(el.dataset.countFrom ?? 0);
    const decimals = Number(el.dataset.countDecimals ?? 0);
    const sep = el.dataset.countSep !== undefined;
    if (!Number.isFinite(to)) return;

    el.textContent = formatNumber(to, decimals, sep);   // final value is the default
    if (!motionOK()) return;

    const state = { v: from };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => {
        gsap.fromTo(state, { v: from }, {
          v: to,
          duration: 1.8,
          ease: 'power3.out',
          onUpdate: () => { el.textContent = formatNumber(state.v, decimals, sep); },
        });
      },
    });
  });
}

/* -- pointer spotlight on cards -------------------------------------------- */

export function initSpotlights(): void {
  if (!finePointer()) return;
  document.querySelectorAll<HTMLElement>('[data-spot]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

/* -- magnetic buttons ------------------------------------------------------ */

export function initMagnetic(): void {
  if (!finePointer() || reducedMotion()) return;

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = 0.28;
    const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });

    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('pointerleave', () => {
      xTo(0);
      yTo(0);
    });
  });
}

/* -- subscribe forms (sample, client-side only) ---------------------------- */

export function initSubscribeForms(): void {
  document.querySelectorAll<HTMLFormElement>('[data-subscribe]').forEach((form) => {
    const input = form.querySelector<HTMLInputElement>('input[type="email"]');
    const note = form.querySelector<HTMLElement>('[data-subscribe-note]');
    const label = form.querySelector<HTMLElement>('[data-subscribe-label]');
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!input || !note || !label || !button) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const value = input.value.trim();
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

      if (!valid) {
        note.textContent = 'Please enter a valid email address.';
        note.dataset.state = 'error';
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }

      input.removeAttribute('aria-invalid');
      note.dataset.state = 'ok';
      note.textContent = 'You are on the list. We will email you when your batch opens.';
      const original = label.textContent;
      label.textContent = 'Added';
      button.disabled = true;
      input.value = '';
      window.setTimeout(() => {
        label.textContent = original;
        button.disabled = false;
      }, 4000);
    });
  });
}

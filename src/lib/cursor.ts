/**
 * Custom cursor dot — fine pointers only, off under reduced motion.
 * Grows over interactive elements; hides when the pointer leaves the window.
 */

import { gsap, finePointer, reducedMotion } from './motion';

const HOVER_SELECTOR = 'a, button, [role="button"], input, textarea, select, summary, [data-cursor-hover]';

export function initCursor(): void {
  const dot = document.querySelector<HTMLElement>('[data-cursor]');
  if (!dot || !finePointer() || reducedMotion()) return;

  const xTo = gsap.quickTo(dot, 'x', { duration: 0.22, ease: 'power3.out' });
  const yTo = gsap.quickTo(dot, 'y', { duration: 0.22, ease: 'power3.out' });

  let shown = false;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    xTo(e.clientX);
    yTo(e.clientY);
    if (!shown) {
      shown = true;
      dot.classList.add('is-on');
    }
    const target = e.target as Element | null;
    dot.classList.toggle('is-hover', !!target?.closest(HOVER_SELECTOR));
  }, { passive: true });

  document.addEventListener('pointerleave', () => dot.classList.remove('is-on'));
  document.addEventListener('pointerenter', () => { if (shown) dot.classList.add('is-on'); });
  window.addEventListener('blur', () => dot.classList.remove('is-on'));
}

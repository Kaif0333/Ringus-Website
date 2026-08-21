/**
 * Benefits section: once the numbered track scrolls into view, the progress
 * hairline draws from nothing to its resting width (32%, set in CSS).
 * Reveals, count-ups and the magnetic button are handled globally.
 */

import { gsap, ScrollTrigger, motionOK } from '../lib/motion';

export function initBenefits(): void {
  const section = document.querySelector<HTMLElement>('#benefits');
  if (!section) return;

  const track = section.querySelector<HTMLElement>('.benefits__track');
  const fill = track?.querySelector<HTMLElement>('[data-progress-fill]') ?? null;
  if (!track || !fill) return;

  // Reduced motion / no IntersectionObserver: the CSS resting state stands.
  if (!motionOK()) return;

  gsap.set(fill, { scaleX: 0, transformOrigin: 'left center' });

  ScrollTrigger.create({
    trigger: track,
    start: 'top 90%',
    once: true,
    onEnter: () => {
      gsap.to(fill, { scaleX: 1, duration: 1.1, ease: 'expo.out', overwrite: 'auto' });
    },
  });
}

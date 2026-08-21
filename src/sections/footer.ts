/**
 * CTA + footer: stamps the current year and wires the back-to-top control.
 *
 * Back to top scrolls smoothly only when motion is allowed, then moves focus
 * to the main landmark (without a second scroll) so keyboard and screen-reader
 * users resume from the start of the page rather than from the footer.
 */

import { motionOK } from '../lib/motion';

export function initFooter(): void {
  const footer = document.querySelector<HTMLElement>('#cta .footer');
  if (!footer) return;

  const year = footer.querySelector<HTMLElement>('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  const toTop = footer.querySelector<HTMLButtonElement>('[data-to-top]');
  if (!toTop) return;

  toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: motionOK() ? 'smooth' : 'auto' });
    const main = document.getElementById('main');
    if (main) main.focus({ preventScroll: true });
  });
}

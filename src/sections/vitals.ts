/**
 * Vitals: the sample dashboard comes alive on first view — the SpO₂ gauge
 * fills, the sleep bars rise, the temperature sparkline draws in. Count-ups
 * and card reveals are global (lib/motion); the ECG sweep is pure CSS and is
 * only paused here while the section is off-screen.
 *
 * Nothing is hidden by default: every rewound "from" state is applied by this
 * module, and only when motionOK() says it will be animated to its end.
 */

import { gsap, ScrollTrigger, motionOK } from '../lib/motion';

/** r = 52 in a 120 × 120 viewBox → circumference (326.7). */
const GAUGE_C = 2 * Math.PI * 52;

function onFirstView(trigger: Element, onEnter: () => void): void {
  ScrollTrigger.create({ trigger, start: 'top 85%', once: true, onEnter });
}

/* -- SpO₂ gauge ------------------------------------------------------------ */

function initGauge(section: HTMLElement, animate: boolean): void {
  const gauge = section.querySelector<HTMLElement>('[data-gauge]');
  const fill = gauge?.querySelector<SVGCircleElement>('[data-gauge-fill]') ?? null;
  if (!gauge || !fill) return;

  // The markup hides the whole gauge from AT, value included. Keep only the
  // ring decorative so the 98 % reads like every other card's value.
  gauge.removeAttribute('aria-hidden');
  gauge.querySelector('svg')?.setAttribute('aria-hidden', 'true');

  const pct = Number(gauge.dataset.gauge);
  const ratio = Number.isFinite(pct) ? Math.min(Math.max(pct, 0), 100) / 100 : 1;
  const filled = GAUGE_C * (1 - ratio);

  fill.style.strokeDasharray = String(GAUGE_C);
  if (!animate) {
    fill.style.strokeDashoffset = String(filled);
    return;
  }

  fill.style.strokeDashoffset = String(GAUGE_C);
  onFirstView(gauge, () => {
    gsap.to(fill, { strokeDashoffset: filled, duration: 1.6, ease: 'expo.out' });
  });
}

/* -- sleep bars ------------------------------------------------------------ */

function initBars(section: HTMLElement, animate: boolean): void {
  const bars = section.querySelector<HTMLElement>('[data-bars]');
  if (!bars) return;

  const spans = Array.from(bars.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
  if (!spans.length) return;

  // Stagger index for the CSS transition, and mark the two best nights.
  spans.forEach((el, i) => el.style.setProperty('--i', String(i)));
  spans
    .map((el) => ({ el, h: Number.parseFloat(el.style.getPropertyValue('--h')) || 0 }))
    .sort((a, b) => b.h - a.h)
    .slice(0, 2)
    .forEach(({ el }) => el.classList.add('is-peak'));

  if (!animate) return;
  bars.classList.add('is-armed');
  onFirstView(bars, () => bars.classList.add('is-live'));
}

/* -- temperature sparkline ------------------------------------------------- */

function initSpark(section: HTMLElement, animate: boolean): void {
  const line = section.querySelector<SVGPolylineElement>('.vitals__spark-line');
  if (!line || !animate) return;

  const length = line.getTotalLength();
  if (!Number.isFinite(length) || length <= 0) return;

  line.style.strokeDasharray = String(length);
  line.style.strokeDashoffset = String(length);
  onFirstView(line, () => {
    gsap.to(line, { strokeDashoffset: 0, duration: 1.4, ease: 'expo.out' });
  });
}

/* -- ECG: pause the CSS sweep while the section is off-screen -------------- */

function initEcg(section: HTMLElement): void {
  const ecg = section.querySelector<SVGSVGElement>('.vitals__ecg');
  if (!ecg) return;

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => ecg.classList.toggle('is-idle', !self.isActive),
  });
  ecg.classList.toggle('is-idle', !trigger.isActive);
}

/* -- entry ----------------------------------------------------------------- */

export function initVitals(): void {
  const section = document.querySelector<HTMLElement>('[data-section="vitals"]');
  if (!section) return;

  const animate = motionOK();
  initGauge(section, animate);
  initBars(section, animate);
  initSpark(section, animate);
  initEcg(section);
}

/**
 * 05 · How it works.
 * A signal runs along the connector joining the three steps as they scroll
 * into view, lighting each node as it passes. The connector's axis is decided
 * in CSS (horizontal on desktop, vertical once the steps stack), so this only
 * drives a single 0–1 progress variable and never has to know the layout.
 */

import { gsap, ScrollTrigger, motionOK } from '../lib/motion';

const PROGRESS_VAR = '--how-p';
const LIT_CLASS = 'is-lit';

export function initHow(): void {
  const section = document.querySelector<HTMLElement>('#how');
  const steps = section?.querySelector<HTMLElement>('[data-how]') ?? null;
  const fill = steps?.querySelector<HTMLElement>('[data-how-line]') ?? null;
  if (!section || !steps || !fill) return;

  const nodes = Array.from(steps.querySelectorAll<HTMLElement>('.how__step'));
  const span = Math.max(nodes.length - 1, 1);

  // A node lights when the sweep reaches its centre. The ends are nudged
  // inwards so the first node never lights before the sweep is visible and
  // the last one lights as the sweep lands rather than a frame after.
  const thresholds = nodes.map((_, i) => Math.min(Math.max(i / span - 0.02, 0.04), 0.96));

  const state = { p: 0 };

  const render = (): void => {
    fill.style.setProperty(PROGRESS_VAR, state.p.toFixed(4));
    nodes.forEach((node, i) => {
      node.classList.toggle(LIT_CLASS, state.p >= (thresholds[i] ?? 1));
    });
  };

  if (!motionOK()) {
    state.p = 1;
    render();
    return;
  }

  // The stylesheet rests with the connector filled so it survives without
  // JS; rewind it here, only now that the sweep is going to drive it.
  render();

  const sweep = gsap.to(state, { p: 1, ease: 'none', paused: true, onUpdate: render });

  ScrollTrigger.create({
    trigger: steps,
    animation: sweep,
    start: 'top 75%',
    end: 'bottom 90%',
    scrub: 0.6,
  });
}

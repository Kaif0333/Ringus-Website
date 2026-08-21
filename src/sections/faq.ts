/**
 * FAQ: single-open accordion over the shared .acc primitives.
 *
 * Each click sets aria-expanded on the trigger and data-open on its panel and
 * closes any other open item. The first item opens on init so the section
 * never reads as empty. Arrow keys, Home and End move focus between triggers;
 * activation stays native to the buttons.
 *
 * The answer-body fade is pure CSS behind a JS-added `is-ready` class, which
 * is only applied when motion is allowed; otherwise bodies render in their
 * final state with no transition.
 */

import { motionOK } from '../lib/motion';

export function initFaq(): void {
  const list = document.querySelector<HTMLElement>('#faq [data-accordion]');
  if (!list) return;

  const triggers = Array.from(list.querySelectorAll<HTMLButtonElement>('.acc__trigger'));
  const first = triggers[0];
  if (!first) return;

  const panelOf = (btn: HTMLButtonElement): HTMLElement | null => {
    const id = btn.getAttribute('aria-controls');
    return id ? document.getElementById(id) : null;
  };

  const setOpen = (btn: HTMLButtonElement, open: boolean): void => {
    btn.setAttribute('aria-expanded', String(open));
    const panel = panelOf(btn);
    if (!panel) return;
    panel.dataset.open = String(open);
    // The collapsed state is purely visual (grid-rows 0fr + overflow hidden),
    // so take closed panels out of the accessibility tree and tab order too;
    // otherwise aria-expanded="false" still reads every answer in full.
    // aria-hidden is the fallback for engines without `inert`.
    panel.inert = !open;
    if (open) panel.removeAttribute('aria-hidden');
    else panel.setAttribute('aria-hidden', 'true');
  };

  /** Open exactly `target` (or nothing, when null) and close the rest. */
  const openOnly = (target: HTMLButtonElement | null): void => {
    triggers.forEach((btn) => setOpen(btn, btn === target));
  };

  /** Move focus to a trigger by index, wrapping at both ends. */
  const focusAt = (index: number): void => {
    const n = triggers.length;
    triggers[((index % n) + n) % n]?.focus();
  };

  // Engage the CSS body fade only when motion is allowed. Done before the
  // first item opens so the initial open paints in its final state.
  if (motionOK()) list.classList.add('is-ready');
  openOnly(first);

  triggers.forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      openOnly(isOpen ? null : btn);
    });

    btn.addEventListener('keydown', (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          focusAt(i + 1);
          break;
        case 'ArrowUp':
          focusAt(i - 1);
          break;
        case 'Home':
          focusAt(0);
          break;
        case 'End':
          focusAt(triggers.length - 1);
          break;
        default:
          return;
      }
      e.preventDefault();
    });
  });
}

/* ==========================================================================
   Ringus — script.js
   Vanilla JavaScript · no dependencies beyond Lucide (loaded via CDN)

   Load order — both scripts are `defer`red in index.html, so they run in
   document order after parsing and before DOMContentLoaded:
     1. lucide.min.js  → exposes window.lucide
     2. script.js      → this file
   ========================================================================== */

(function () {
  'use strict';

  const root = document.documentElement;

  /* Progressive-enhancement flag: CSS can target `.js` / `.no-js`. */
  root.classList.remove('no-js');
  root.classList.add('js');

  /* `.fonts-loaded` is added only once Host Grotesk has actually resolved
     (not merely when font loading has settled) — useful for any animation
     that measures text (word masks, split headlines, etc.). If the Google
     Fonts stylesheet is blocked or the face fails, the class stays off. */
  if ('fonts' in document) {
    document.fonts.load('1em "Host Grotesk"')
      .then(function (faces) {
        if (faces.length) {
          root.classList.add('fonts-loaded');
        }
      })
      .catch(function () {
        /* Font unavailable — fallback stack is in use; nothing to do. */
      });
  }

  /**
   * Render Lucide icons.
   * Swaps every `<i data-lucide="name">` for an inline
   * `<svg class="lucide lucide-name">`. Attributes on the placeholder
   * (class, aria-hidden, …) are carried over to the SVG.
   */
  function initIcons() {
    const lucide = window.lucide;

    if (!lucide || typeof lucide.createIcons !== 'function') {
      console.warn('[Ringus] Lucide did not load — icons will not render.');
      return;
    }

    lucide.createIcons();
  }

  /** Stamp the current year into every `[data-year]` element. */
  function initYear() {
    const year = String(new Date().getFullYear());

    document.querySelectorAll('[data-year]').forEach(function (el) {
      el.textContent = year;
    });
  }

  /** Entry point — register new feature initialisers here. */
  function init() {
    initIcons();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

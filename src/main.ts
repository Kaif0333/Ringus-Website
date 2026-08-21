import './styles/main.css';

import { initIcons } from './lib/icons';
import {
  ScrollTrigger,
  initCounters,
  initMagnetic,
  initReveals,
  initSpotlights,
  initSubscribeForms,
} from './lib/motion';
import { initCursor } from './lib/cursor';
import { initPreloader } from './sections/preloader';
import { initNav } from './sections/nav';
import { initHero } from './sections/hero';
import { initProduct } from './sections/product';
import { initVitals } from './sections/vitals';
import { initBenefits } from './sections/benefits';
import { initHow } from './sections/how';
import { initProof } from './sections/proof';
import { initMembership } from './sections/membership';
import { initFaq } from './sections/faq';
import { initFooter } from './sections/footer';

const root = document.documentElement;
root.classList.remove('no-js');
root.classList.add('js');

if ('fonts' in document) {
  document.fonts.load('1em "Host Grotesk"')
    .then((faces) => { if (faces.length) root.classList.add('fonts-loaded'); })
    .catch(() => { /* fallback stack in use */ });
}

function boot(): void {
  initIcons();
  const preloader = initPreloader();

  initNav();
  initCursor();
  initReveals();
  initCounters();
  initSpotlights();
  initMagnetic();
  initSubscribeForms();

  initHero();
  initVitals();
  initBenefits();
  initHow();
  initProof();
  initMembership();
  initFaq();
  initFooter();
  initProduct();

  preloader.ready().then(() => {
    ScrollTrigger.refresh();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

/**
 * Navigation: compact-on-scroll bar, scroll progress, active-section
 * highlighting, and the full-screen mobile menu.
 */

import { gsap, ScrollTrigger, motionOK } from '../lib/motion';

export function initNav(): void {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!nav) return;

  /* -- compact on scroll --------------------------------------------------- */
  const onScroll = (): void => {
    nav.classList.toggle('is-scrolled', window.scrollY > 24);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* -- scroll progress ----------------------------------------------------- */
  const bar = nav.querySelector<HTMLElement>('[data-scroll-progress]');
  if (bar) {
    const update = (): void => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      bar.style.transform = `scaleX(${p})`;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  /* -- active section ------------------------------------------------------ */
  const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('[data-nav-link]'));
  const setActive = (id: string | null): void => {
    links.forEach((a) => {
      const on = a.dataset.navLink === id;
      if (on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  };

  const sections = Array.from(document.querySelectorAll<HTMLElement>('main > section[id]'));
  if ('IntersectionObserver' in window) {
    sections.forEach((section) => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: (self) => {
          if (self.isActive) setActive(links.some((a) => a.dataset.navLink === section.id) ? section.id : null);
        },
      });
    });
  }

  /* -- mobile menu --------------------------------------------------------- */
  const toggle = nav.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  if (!toggle || !menu) return;

  const menuLinks = Array.from(menu.querySelectorAll<HTMLElement>('[data-menu-link]'));
  let open = false;

  const setOpen = (next: boolean): void => {
    if (next === open) return;
    open = next;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('menu-open', open);

    if (open) {
      menu.hidden = false;
      nav.classList.add('is-menu-open');
      if (motionOK()) {
        gsap.fromTo(menu, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'power2.out' });
        gsap.fromTo(menuLinks, { y: 28, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.7, ease: 'expo.out', stagger: 0.06, delay: 0.1 });
      }
      menuLinks[0]?.focus({ preventScroll: true });
    } else {
      nav.classList.remove('is-menu-open');
      const hide = (): void => { menu.hidden = true; };
      if (motionOK()) {
        gsap.to(menu, { autoAlpha: 0, duration: 0.25, ease: 'power2.in', onComplete: hide });
      } else {
        hide();
      }
      toggle.focus({ preventScroll: true });
    }
  };

  toggle.addEventListener('click', () => setOpen(!open));
  menuLinks.forEach((a) => a.addEventListener('click', () => setOpen(false)));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });

  // Close if the viewport grows past the mobile breakpoint while open.
  const mq = window.matchMedia('(min-width: 64em)');
  mq.addEventListener('change', (e) => { if (e.matches) setOpen(false); });
}

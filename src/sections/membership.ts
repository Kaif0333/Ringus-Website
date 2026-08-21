/**
 * Membership: monthly / yearly billing switch.
 *
 * Flips the switch state, the `[data-billing]` hook on the plan grid and the
 * active label, then tweens every price from its current value to the target
 * (snapping to 0.1 for decimal targets, 1 for integers) and swaps the
 * "/ month" suffix. Under reduced motion every value is set instantly.
 */

import { gsap, motionOK } from '../lib/motion';

type Billing = 'monthly' | 'yearly';

interface Price {
  el: HTMLElement;
  value: Record<Billing, number>;
  state: { v: number };
}

const PER_TEXT: Record<Billing, string> = {
  monthly: '/ month',
  yearly: '/ month, billed yearly',
};

const isBilling = (value: string | undefined): value is Billing =>
  value === 'monthly' || value === 'yearly';

/* 6.4 → "6.40", 15.2 → "15.20", 8 → "8" */
function formatPrice(value: number, decimals: boolean): string {
  return decimals ? value.toFixed(2) : String(Math.round(value));
}

export function initMembership(): void {
  const section = document.querySelector<HTMLElement>('[data-section="membership"]');
  if (!section) return;

  const toggle = section.querySelector<HTMLButtonElement>('[data-billing-toggle]');
  const plans = section.querySelector<HTMLElement>('[data-plans]');
  if (!toggle || !plans) return;

  const labels = Array.from(section.querySelectorAll<HTMLElement>('[data-billing-label]'));
  const pers = Array.from(plans.querySelectorAll<HTMLElement>('[data-per]'));

  const initial = plans.dataset.billing;
  let billing: Billing = isBilling(initial) ? initial : 'monthly';

  const prices: Price[] = [];
  plans.querySelectorAll<HTMLElement>('[data-price-monthly]').forEach((el) => {
    const monthly = Number(el.dataset.priceMonthly);
    const yearly = Number(el.dataset.priceYearly ?? el.dataset.priceMonthly);
    if (!Number.isFinite(monthly) || !Number.isFinite(yearly)) return;
    prices.push({
      el,
      value: { monthly, yearly },
      state: { v: billing === 'yearly' ? yearly : monthly },
    });
  });

  const animate = motionOK();

  const apply = (next: Billing, instant: boolean): void => {
    billing = next;
    toggle.setAttribute('aria-checked', String(next === 'yearly'));
    plans.dataset.billing = next;
    labels.forEach((label) => {
      label.classList.toggle('is-active', label.dataset.billingLabel === next);
    });

    prices.forEach((price) => {
      const target = price.value[next];
      const decimals = !Number.isInteger(target);

      if (instant || price.state.v === target) {
        gsap.killTweensOf(price.state);
        price.state.v = target;
        price.el.textContent = formatPrice(target, decimals);
        return;
      }

      gsap.to(price.state, {
        v: target,
        duration: 0.6,
        ease: 'expo.out',
        snap: { v: decimals ? 0.1 : 1 },
        overwrite: true,
        onUpdate: () => {
          price.el.textContent = formatPrice(price.state.v, decimals);
        },
      });
    });

    pers.forEach((per) => {
      per.textContent = PER_TEXT[next];
      if (!instant) {
        gsap.fromTo(
          per,
          { opacity: 0 },
          { opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: true },
        );
      }
    });
  };

  // Make the DOM agree with whatever [data-billing] the markup starts with.
  apply(billing, true);

  toggle.addEventListener('click', () => {
    apply(billing === 'yearly' ? 'monthly' : 'yearly', !animate);
  });

  // Labels act as click proxies for the switch, the way <label for> would;
  // the switch itself stays the single focusable control.
  labels.forEach((label) => {
    label.addEventListener('click', () => {
      const target = label.dataset.billingLabel;
      if (isBilling(target) && target !== billing) apply(target, !animate);
    });
  });
}

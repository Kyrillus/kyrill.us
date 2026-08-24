// Text entrances: fade + 12px rise, once. In-view elements run as part
// of the orchestrated load sequence (60ms stagger); below-fold sections
// reveal on first scroll into view — no scrub, no pinning.
// Hand-rolled on the Web Animations API; no animation library needed.

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

export interface Reveals {
  start: () => void;
  skip: () => void;
}

export function initReveals(reduced: boolean): Reveals {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-section]'),
  );
  if (reduced || els.length === 0) {
    return { start: () => {}, skip: () => {} };
  }

  for (const el of els) {
    el.style.opacity = '0';
  }
  const pending = new Set(els);

  const show = (el: HTMLElement, delay = 0, instant = false) => {
    if (!pending.has(el)) return;
    pending.delete(el);
    el.style.opacity = '';
    if (!instant) {
      el.animate(
        [
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 800, delay: delay * 1000, easing: EASE, fill: 'backwards' },
      );
    }
  };

  const inView = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  };

  const start = () => {
    // load sequence: everything already on screen rises with a stagger,
    // the rest waits for scroll
    let i = 0;
    els.forEach((el) => {
      if (inView(el)) show(el, i++ * 0.06);
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            show(e.target as HTMLElement);
            io.unobserve(e.target);
          }
        });
        if (pending.size === 0) io.disconnect();
      },
      { threshold: 0.12 },
    );
    pending.forEach((el) => io.observe(el));
  };

  const skip = () => {
    els.forEach((el) => {
      if (inView(el)) show(el, 0, true);
    });
  };

  return { start, skip };
}

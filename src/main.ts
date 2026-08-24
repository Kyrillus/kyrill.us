// Boot. The page is complete without any of this — everything here is
// an enhancement layer: load sequence and the targeting cursor.

import { initReveals } from './motion/reveal';
import { resolveWordmark } from './motion/wordmark';
import { initCursor } from './motion/cursor';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduced) {
  initCursor();
}

// the point field loads lazily at idle time — the page never waits on it
const startField = () =>
  import('./scene/boot').then((m) => m.bootScene(reduced)).catch(() => {});
const idle: typeof requestIdleCallback | undefined = window.requestIdleCallback;
if (idle) {
  idle(() => startField(), { timeout: 1500 });
} else {
  window.setTimeout(startField, 600);
}

const reveals = initReveals(reduced);

if (!reduced) {
  // wait for the preloaded fonts (capped) so the wordmark resolves into
  // Departure Mono, not a fallback that then swaps
  const fontsReady = Promise.race([
    document.fonts?.ready ?? Promise.resolve(),
    new Promise((r) => window.setTimeout(r, 250)),
  ]);

  fontsReady.then(() => {
    const wordmarkEl = document.getElementById('wordmark');
    const wordmark = wordmarkEl ? resolveWordmark(wordmarkEl) : { skip: () => {} };

    // one orchestrated sequence: wordmark starts resolving, text rises
    // right behind it (the stagger provides the "then")
    const revealTimer = window.setTimeout(() => reveals.start(), 120);

    // skippable by scroll (or any scroll-intent input)
    const skip = () => {
      wordmark.skip();
      window.clearTimeout(revealTimer);
      reveals.skip();
      reveals.start();
      removeSkipListeners();
    };
    const removeSkipListeners = () => {
      window.removeEventListener('wheel', skip);
      window.removeEventListener('touchstart', skip);
      window.removeEventListener('scroll', skip);
    };
    window.addEventListener('wheel', skip, { passive: true, once: true });
    window.addEventListener('touchstart', skip, { passive: true, once: true });
    window.addEventListener('scroll', skip, { passive: true, once: true });
    window.setTimeout(removeSkipListeners, 2200);
  });
}

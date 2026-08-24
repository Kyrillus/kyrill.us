// Wordmark entrance: each character resolves through a few frames of
// pixel noise into its Departure Mono glyph — a nod to the old site's
// ASCII wordmark. Runs once, never loops.

const NOISE = '░▒▓█#%*+=<>/'.split('');
const STAGGER_MS = 40;
const FRAME_MS = 70;
const FRAMES = 3;

export function resolveWordmark(el: HTMLElement): { skip: () => void } {
  const text = el.textContent ?? '';
  const chars = text.split('');

  el.setAttribute('aria-label', text);
  el.textContent = '';
  const spans = chars.map((c, i) => {
    const s = document.createElement('span');
    s.setAttribute('aria-hidden', 'true');
    s.textContent = NOISE[(i * 7) % NOISE.length]; // visible from frame one
    s.dataset.final = c;
    el.appendChild(s);
    return s;
  });

  let raf = 0;
  let done = false;
  const t0 = performance.now();

  const finish = () => {
    done = true;
    cancelAnimationFrame(raf);
    spans.forEach((s) => (s.textContent = s.dataset.final ?? ''));
  };

  const tick = (now: number) => {
    if (done) return;
    let resolved = 0;
    spans.forEach((s, i) => {
      const elapsed = now - t0 - i * STAGGER_MS;
      if (elapsed < 0) return; // still on its initial noise glyph
      const frame = Math.floor(elapsed / FRAME_MS);
      if (frame >= FRAMES) {
        s.textContent = s.dataset.final ?? '';
        resolved++;
      } else {
        // deterministic pseudo-noise so a char never flickers on one glyph
        s.textContent = NOISE[(i * 7 + frame * 5) % NOISE.length];
      }
    });
    if (resolved === spans.length) {
      done = true;
      return;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return { skip: finish };
}

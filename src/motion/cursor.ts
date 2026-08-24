// Sci-fi targeting cursor: a pixel dot glued to the pointer and a
// corner-bracket reticle that trails it with lag, locking on when a
// link is under it. Enhancement only — touch devices and
// reduced-motion keep the native cursor.

export function initCursor(): void {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const dot = document.createElement('div');
  dot.className = 'cur-dot';
  const ret = document.createElement('div');
  ret.className = 'cur-ret';
  for (let i = 0; i < 4; i++) ret.appendChild(document.createElement('span'));
  dot.setAttribute('aria-hidden', 'true');
  ret.setAttribute('aria-hidden', 'true');
  document.body.append(dot, ret);
  document.documentElement.classList.add('has-cursor');

  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let rx = x;
  let ry = y;
  let scale = 1;
  let scaleGoal = 1;
  let down = false;
  let locked = false;
  let visible = false;
  let last = performance.now();

  const setVisible = (v: boolean) => {
    if (visible === v) return;
    visible = v;
    dot.classList.toggle('is-vis', v);
    ret.classList.toggle('is-vis', v);
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      x = e.clientX;
      y = e.clientY;
      if (!visible) {
        rx = x;
        ry = y;
        setVisible(true);
      }
    },
    { passive: true },
  );
  document.documentElement.addEventListener('mouseleave', () => setVisible(false));
  window.addEventListener('blur', () => setVisible(false));

  // lock onto links
  document.addEventListener('mouseover', (e) => {
    locked = Boolean((e.target as Element | null)?.closest?.('a'));
    ret.classList.toggle('is-locked', locked);
  });
  window.addEventListener('pointerdown', () => (down = true));
  window.addEventListener('pointerup', () => (down = false));

  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    // dot is instant; the reticle drags behind (servo feel, not a trail)
    const k = 1 - Math.exp(-14 * dt);
    rx += (x - rx) * k;
    ry += (y - ry) * k;
    scaleGoal = down ? 0.75 : locked ? 1.45 : 1;
    scale += (scaleGoal - scale) * (1 - Math.exp(-18 * dt));
    dot.style.transform = `translate3d(${x - 2.5}px, ${y - 2.5}px, 0)`;
    ret.style.transform = `translate3d(${rx - 14}px, ${ry - 14}px, 0) scale(${scale})`;
  };
  requestAnimationFrame(frame);
}

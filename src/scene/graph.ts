// The mysterious layer: a thin exponential curve compounding in the
// dark, forever. Growth runs in log space (so it never overflows) at a
// quiet base rate; a click injects rate that decays away, and HOLDING
// pours rate in continuously. A hold is the rocket moment: the line
// blooms into real light (UnrealBloom), the dark warms a shade, speed
// streaks race past and the frame shakes — then it all cools back to
// the quiet grind on release.

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface GraphOpts {
  lite: boolean;
  reduced: boolean;
}

const WINDOW_S = 35; // seconds of history on screen
const SAMPLE_S = 0.07; // one vertex every 70ms
const MAX_PTS = Math.ceil(WINDOW_S / SAMPLE_S) + 8;
const BASE_RATE = 0.12; // log-units per second — the quiet compounding
const CLICK_RATE = 0.35; // extra rate per tap, bled in over ~1s
const HOLD_RATE = 1.3; // extra rate poured in per second while holding
const MAX_EXCESS = 6; // keeps a long hold steep, not degenerate
const RATE_TAU = 2.6; // seconds for a boost to decay
const N_STREAKS = 36;

export function createGraph(opts: GraphOpts): void {
  const canvas = document.createElement('canvas');
  canvas.className = 'field';
  canvas.setAttribute('aria-hidden', 'true');

  let renderer: THREE.WebGLRenderer;
  try {
    // opaque canvas: bloom composites against the real background,
    // which is also what lets the whole "room" warm up during a hold
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    return;
  }
  document.body.prepend(canvas);
  renderer.setPixelRatio(opts.lite ? 1 : Math.min(window.devicePixelRatio, 2));

  const BG_COLD = new THREE.Color(0x0b0d11);
  const BG_HOT = new THREE.Color(0x1a0e06); // dark ember, not a light show
  const LINE_COL = new THREE.Color(0xc9cdd3);
  const ACCENT_COL = new THREE.Color(0xf25c05);
  const HOT_CORE = new THREE.Color(0xffb37a); // bloom feeds on brightness

  const scene = new THREE.Scene();
  scene.background = BG_COLD.clone();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  let halfW = 1;
  const halfH = 1;

  // lite tier renders without post-processing — the color/opacity ramp
  // still reads as acceleration, just without the light bleed
  const composer = opts.lite ? null : new EffectComposer(renderer);
  const bloom = composer ? new UnrealBloomPass(new THREE.Vector2(2, 2), 0, 0.85, 0) : null;
  if (composer && bloom) {
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
  }

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
    halfW = w / h;
    camera.left = -halfW;
    camera.right = halfW;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  // ── curve ────────────────────────────────────────────────────────
  const positions = new Float32Array(MAX_PTS * 3);
  const geometry = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  geometry.setAttribute('position', posAttr);
  const lineMat = new THREE.LineBasicMaterial({
    color: LINE_COL.clone(),
    transparent: true,
    opacity: 0.26,
  });
  const line = new THREE.Line(geometry, lineMat);
  line.frustumCulled = false;
  scene.add(line);

  // accent tip — the only orange at rest
  const tip = new THREE.Mesh(
    new THREE.CircleGeometry(1, 24),
    new THREE.MeshBasicMaterial({ color: ACCENT_COL.clone() }),
  );
  scene.add(tip);
  const tipMat = tip.material as THREE.MeshBasicMaterial;

  // ── speed streaks: invisible until the rocket lights ─────────────
  const streakPos = new Float32Array(N_STREAKS * 2 * 3);
  const streakX = new Float32Array(N_STREAKS);
  const streakY = new Float32Array(N_STREAKS);
  const streakV = new Float32Array(N_STREAKS);
  for (let i = 0; i < N_STREAKS; i++) {
    streakX[i] = (Math.random() * 2 - 1) * 2;
    streakY[i] = (Math.random() * 2 - 1) * 1.05;
    streakV[i] = 2.5 + Math.random() * 3.5;
  }
  const streakGeo = new THREE.BufferGeometry();
  const streakAttr = new THREE.BufferAttribute(streakPos, 3);
  streakGeo.setAttribute('position', streakAttr);
  const streakMat = new THREE.LineBasicMaterial({
    color: 0xf2965c,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const streaks = new THREE.LineSegments(streakGeo, streakMat);
  streaks.frustumCulled = false;
  streaks.visible = false;
  scene.add(streaks);

  // ── compounding state ────────────────────────────────────────────
  interface Sample {
    t: number;
    logV: number;
  }
  const samples: Sample[] = [];
  let logV = 0;
  let excess = 0;
  let tipY = 0;
  let tipPulse = 0;
  let now = 0;
  let sampleAccum = 0;
  let holding = false;
  let holdGlow = 0;

  for (let i = MAX_PTS - 1; i >= 0; i--) {
    const t = -i * SAMPLE_S;
    samples.push({ t, logV: t * BASE_RATE });
  }

  // a quick tap feeds a reservoir that bleeds into the rate over ~1s —
  // a smooth swell of acceleration, never a step (a step puts a kink
  // in the trail); a real hold ramps from zero the same way
  let holdTime = 0;
  let pending = 0;
  window.addEventListener('pointerdown', () => {
    tipPulse = 1;
    holding = true;
    holdTime = 0;
  });
  const release = () => {
    if (holding && holdTime < 0.25) pending += CLICK_RATE;
    holding = false;
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('blur', release);

  const X1 = () => halfW * 0.55;
  const Y_BASE = -halfH * 0.72;
  const Y_EQ = halfH * 0.02;
  const Y_MAX = halfH * 0.8;

  const draw = () => {
    const x0 = -halfW;
    const x1 = X1();
    const n = samples.length;
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const fx = 1 - (now - s.t) / WINDOW_S;
      const rel = Math.exp(s.logV - logV);
      positions[i * 3] = x0 + (x1 - x0) * fx;
      positions[i * 3 + 1] = Y_BASE + (tipY - Y_BASE) * rel;
      positions[i * 3 + 2] = 0;
    }
    posAttr.needsUpdate = true;
    geometry.setDrawRange(0, n);

    tip.position.set(x1, tipY, 0);
    const px = (2 * halfH) / window.innerHeight;
    tip.scale.setScalar(px * (2.4 + tipPulse * 5 + holdGlow * 2.5));
    if (composer) composer.render();
    else renderer.render(scene, camera);
  };

  if (opts.reduced) {
    tipY = Y_EQ;
    draw();
    window.addEventListener('resize', draw);
    return;
  }

  // the affordance only exists where the interaction does
  const hint = document.createElement('div');
  hint.className = 'hold-hint';
  hint.textContent = '[ hold ]';
  hint.setAttribute('aria-hidden', 'true');
  document.body.appendChild(hint);
  let hintDone = false;

  let visible = !document.hidden;
  let last = performance.now();
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    last = performance.now();
  });
  let contextLost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    contextLost = true;
    canvas.style.display = 'none';
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    canvas.style.display = '';
  });

  // the page itself leans into the acceleration: a sub-2px shake fed
  // through CSS vars, zeroed the moment things calm down
  const rootStyle = document.documentElement.style;
  let shakeActive = false;
  const setShake = (ax: number, ay: number) => {
    rootStyle.setProperty('--shake-x', ax.toFixed(2));
    rootStyle.setProperty('--shake-y', ay.toFixed(2));
    shakeActive = ax !== 0 || ay !== 0;
  };

  const frame = (t: number) => {
    requestAnimationFrame(frame);
    if (!visible || contextLost) return;
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    now += dt;

    // compound: linear in log space, so boosts multiply growth.
    // the pour-in itself ramps over the first ~2s of a hold, so the
    // acceleration is something you feel building, not a step
    if (holding) {
      holdTime += dt;
      const ramp = Math.min(holdTime / 2, 1);
      excess = Math.min(excess + HOLD_RATE * ramp * dt, MAX_EXCESS);
    }
    if (pending > 0.001) {
      const flow = pending * (1 - Math.exp(-dt / 0.9));
      pending -= flow;
      excess = Math.min(excess + flow, MAX_EXCESS);
    }
    excess *= Math.exp(-dt / RATE_TAU);
    logV += (BASE_RATE + excess) * dt;
    // the heat builds linearly over ~1.8s and cools in ~0.9s, so the
    // CGI swells with the climb instead of igniting instantly
    holdGlow = THREE.MathUtils.clamp(
      holdGlow + (holding ? dt / 1.8 : -dt / 0.9),
      0,
      1,
    );

    sampleAccum += dt;
    if (sampleAccum >= SAMPLE_S) {
      sampleAccum = 0;
      samples.push({ t: now, logV });
      while (samples.length > 2 && samples[0].t < now - WINDOW_S) samples.shift();
    }

    // once the hold is discovered, the hint retires for good
    if (!hintDone && holding && holdTime > 0.8) {
      hintDone = true;
      hint.classList.add('is-done');
    }

    // linear in the accumulated rate — the climb is earned, not given
    const lift = Math.min(excess / 4, 1);
    const tipTarget = Y_EQ + (Y_MAX - Y_EQ) * lift;
    tipY += (tipTarget - tipY) * (1 - Math.exp(-1.8 * dt));

    // ── the rocket dressing, all driven by holdGlow ────────────────
    const heat = holdGlow;

    // line: dim gray → hot core (bloom turns brightness into light)
    lineMat.opacity = Math.min(0.26 + 0.3 * lift + 0.5 * heat, 1);
    lineMat.color.copy(LINE_COL).lerp(ACCENT_COL, Math.min(heat * 1.4, 1));
    lineMat.color.lerp(HOT_CORE, heat * heat * 0.8);
    tipMat.color.copy(ACCENT_COL).lerp(HOT_CORE, heat);
    if (bloom) bloom.strength = 0.25 * lift + 2.2 * heat;

    // the room warms a shade
    (scene.background as THREE.Color).copy(BG_COLD).lerp(BG_HOT, heat);

    // speed streaks race past, faster the harder it compounds
    streaks.visible = heat > 0.02;
    if (streaks.visible) {
      streakMat.opacity = 0.28 * heat;
      const v = 1 + excess * 0.6;
      for (let i = 0; i < N_STREAKS; i++) {
        streakX[i] -= streakV[i] * v * dt * 0.4;
        if (streakX[i] < -halfW - 0.6) {
          streakX[i] = halfW + 0.6;
          streakY[i] = (Math.random() * 2 - 1) * 1.05;
        }
        const len = 0.05 + 0.05 * streakV[i] * v * heat;
        streakPos[i * 6] = streakX[i];
        streakPos[i * 6 + 1] = streakY[i];
        streakPos[i * 6 + 3] = streakX[i] + len;
        streakPos[i * 6 + 4] = streakY[i];
      }
      streakAttr.needsUpdate = true;
    }

    // shake: camera plus a sub-2px nudge on the page itself
    const shake = heat * heat * (0.5 + lift * 0.5);
    if (shake > 0.01) {
      camera.position.x = (Math.random() - 0.5) * 0.012 * shake;
      camera.position.y = (Math.random() - 0.5) * 0.012 * shake;
      // negative-only offsets: top/left overflow never creates scroll
      setShake(-Math.random() * 3 * shake, -Math.random() * 3 * shake);
    } else if (shakeActive || camera.position.x !== 0) {
      camera.position.set(0, 0, 1);
      setShake(0, 0);
      shakeActive = false;
    }

    tipPulse *= Math.exp(-dt * 5);
    draw();
  };
  tipY = Y_EQ;
  requestAnimationFrame(frame);
}

// Tier detection for the compounding curve. The page is complete
// without it — no WebGL simply means the void stays quiet.

export async function bootScene(reduced: boolean): Promise<void> {
  const webgl = (() => {
    try {
      const c = document.createElement('canvas');
      return Boolean(
        window.WebGLRenderingContext &&
          (c.getContext('webgl2') || c.getContext('webgl')),
      );
    } catch {
      return false;
    }
  })();
  if (!webgl) return;

  const nav = navigator as Navigator & { deviceMemory?: number };
  const lite =
    (navigator.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;

  const { createGraph } = await import('./graph');
  createGraph({ lite, reduced });
}

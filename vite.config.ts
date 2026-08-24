import { defineConfig, type Plugin } from 'vite';

// The bundled CSS is ~3KB — inlining it removes the one render-blocking
// request without adding a dependency.
function inlineCss(): Plugin {
  return {
    name: 'inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        for (const [name, asset] of Object.entries(bundle)) {
          if (asset.type === 'asset' && name.endsWith('.css')) {
            const tag = new RegExp(
              `<link[^>]*href="[^"]*${asset.fileName.replace(/[/.]/g, '\\$&')}"[^>]*>`,
            );
            if (tag.test(html)) {
              html = html.replace(tag, `<style>${asset.source}</style>`);
              delete bundle[name];
            }
          }
        }
        return html;
      },
    },
  };
}

export default defineConfig({
  plugins: [inlineCss()],
});

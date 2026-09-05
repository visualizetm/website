import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { BOOT_CSS, BOOT_FRAME_HTML } from './src/shell/bootFrame.js';

/* Prompt 14: inject the admin boot frame (src/shell/bootFrame.js) into
 * index.html at build and dev time, so the parser paints the shell outline
 * before the bundle runs. One source for the markup React renders too. */
function vzBootFrame() {
  return {
    name: 'vz-boot-frame',
    transformIndexHtml(html) {
      return html
        .replace('<!-- vz-boot-css -->', `<style id="vz-boot-css">${BOOT_CSS}</style>`)
        .replace('<!-- vz-boot -->', BOOT_FRAME_HTML);
    },
  };
}

export default defineConfig({
  plugins: [react(), vzBootFrame()],
  base: '/',
  define: {
    // Vercel injects VERCEL_GIT_COMMIT_SHA at build time — surfaced in the
    // footer so a live deploy can be matched to a commit at a glance.
    __BUILD_SHA__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)),
  },
});

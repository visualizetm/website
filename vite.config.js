import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
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

/* Prompt 15: the admin Content-Security-Policy in vercel.json allows exactly
 * one inline script, the pre-paint script in index.html, by hash. Any edit to
 * that script changes the hash; this plugin computes it at build time and
 * writes it into vercel.json (a mismatch would blank the admin in production). */
function vzCspHash() {
  return {
    name: 'vz-csp-hash',
    apply: 'build',
    transformIndexHtml(html) {
      const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
      if (inline.length !== 1) throw new Error(`vz-csp-hash: expected one inline script in index.html, found ${inline.length}`);
      const hash = createHash('sha256').update(inline[0]).digest('base64');
      const path = new URL('./vercel.json', import.meta.url);
      const json = readFileSync(path, 'utf8');
      const next = json.replace(/'sha256-[A-Za-z0-9+/=_]*'/, `'sha256-${hash}'`);
      if (next !== json) { writeFileSync(path, next); console.log(`vz-csp-hash: vercel.json now pins sha256-${hash}`); }
      return html;
    },
  };
}

export default defineConfig({
  plugins: [react(), vzBootFrame(), vzCspHash()],
  base: '/',
  define: {
    // Vercel injects VERCEL_GIT_COMMIT_SHA at build time — surfaced in the
    // footer so a live deploy can be matched to a commit at a glance.
    __BUILD_SHA__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)),
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    // Vercel injects VERCEL_GIT_COMMIT_SHA at build time — surfaced in the
    // footer so a live deploy can be matched to a commit at a glance.
    __BUILD_SHA__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)),
  },
});

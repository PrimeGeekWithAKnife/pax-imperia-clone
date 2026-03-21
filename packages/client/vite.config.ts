import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@nova-imperia/shared': resolve(__dirname, '../shared/src'),
    },
  },
  // Prevent Vite from obscuring Rust errors
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 5174,
        }
      : undefined,
    watch: {
      // Tell Vite to ignore watching src-tauri
      ignored: ['**/src-tauri/**'],
    },
  },
  // Env variables starting with TAURI_ are available in the frontend
  envPrefix: ['VITE_', 'TAURI_'],
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  // React + Supabase SDK ≈ 550 kB raw / 160 kB gzipped — acceptable for an internal admin app.
  build: { chunkSizeWarningLimit: 700 },
});

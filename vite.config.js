import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { seoPlugin } from './tools/seo.js';

// Trois pages (accueil, jeu, retour de paiement), servies en production par server/index.mjs.
// En développement, /api est relayé vers ce serveur (npm run serveur, port 3000).
// base './' : le site fonctionne à la racine d'un domaine comme dans un sous-dossier.
export default defineConfig({
  base: './',
  plugins: [react(), seoPlugin()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        jeu: resolve(__dirname, 'jeu.html'),
        achat: resolve(__dirname, 'achat.html'),
      },
      output: { manualChunks: { three: ['three'], react: ['react', 'react-dom'] } },
    },
  },
});

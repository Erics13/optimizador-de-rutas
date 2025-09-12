import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  },
  // Para GitHub Pages, si tu repo se llama "mi-repo":
  base: '/optimizador-de-rutas/',  
});


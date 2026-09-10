import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
export default defineConfig({
  css: { postcss: { plugins: [tailwindcss()] } },
  server: {
    host: '127.0.0.1',
    port: 4318,
    strictPort: true,
    watch: { usePolling: true },
    proxy: { '/api': 'http://127.0.0.1:4319' },
  },
  plugins: [vinext()],
});

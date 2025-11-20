import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: '/armillary/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 8080,
    open: false
  }
});

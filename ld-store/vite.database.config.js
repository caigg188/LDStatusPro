import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  envDir: false,
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { 'import.meta.env.VITE_FARO_ENABLED': JSON.stringify('0') },
  server: {
    host: '127.0.0.1',
    port: 4198,
    strictPort: true,
    open: false,
    hmr: false,
    proxy: { '/api': { target: 'http://127.0.0.1:8798', changeOrigin: true } }
  }
});

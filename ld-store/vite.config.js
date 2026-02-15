import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3001,
    open: true,
    proxy: {
      '/api/auth': {
        target: 'https://api1.ldspro.qzz.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path
      },
      '/api/image': {
        target: 'https://api.ldspro.qzz.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path
      },
      '/api': {
        target: 'https://api2.ldspro.qzz.io',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'utils': ['@vueuse/core']
        }
      }
    }
  }
})

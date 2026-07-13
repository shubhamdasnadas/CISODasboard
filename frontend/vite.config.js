import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://10.134.243.128:5000', // your actual backend port
        changeOrigin: true,
      },
    },
    host: true,
  },
});
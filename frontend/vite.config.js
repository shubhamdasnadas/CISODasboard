import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
<<<<<<< HEAD
        target: 'http://0.0.0.0:5000', // your actual backend port
=======
        target: 'http://localhost:3001', // your actual backend port
>>>>>>> 3c195bf (MDM page)
        changeOrigin: true,
      },
    },
  },
});
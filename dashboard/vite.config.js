import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
      interval: 1000, // Increase interval to once per second
      ignored: ['**/node_modules/**', '**/dist/**'], // DO NOT SCAN THESE
    }
  }
})
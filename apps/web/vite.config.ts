import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/_opengate': 'http://localhost:18765',
      '/c': 'http://localhost:18765',
      '/v1': 'http://localhost:18765',
    }
  },
  build: {
    outDir: 'dist'
  }
})

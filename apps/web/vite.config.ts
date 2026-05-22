import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = process.env.OPENGATE_DEV_PROXY || 'http://localhost:18765'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/_opengate': apiTarget,
      '/c': apiTarget,
      '/v1': apiTarget,
    }
  },
  build: {
    outDir: 'dist'
  }
})

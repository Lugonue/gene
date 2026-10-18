import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const serverPort = Number(process.env.GENE_PORT ?? 3000)

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/ws': { target: `ws://localhost:${serverPort}`, ws: true },
      '/health': { target: `http://localhost:${serverPort}` },
    },
  },
})

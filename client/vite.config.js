import path from 'path'
import fs from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Read backend port from config.json
const getBackendPort = () => {
  try {
    const configPath = path.resolve(__dirname, '../config.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return config.server?.port || 8045
  } catch (e) {
    console.warn('Could not read config.json, using default port 8045')
    return 8045
  }
}

const backendPort = getBackendPort()

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/admin': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        secure: false,
      },
      '/v1': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        secure: false,
      },
      '/sdapi': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

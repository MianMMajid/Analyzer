import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const previewAllowedHosts = [
  'frontend-production-c68e.up.railway.app',
  process.env['RAILWAY_PUBLIC_DOMAIN'],
  ...(process.env['VITE_PREVIEW_ALLOWED_HOSTS'] ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter((host) => host.length > 0),
].filter((host): host is string => host !== undefined)

// Vite owns the frontend build and keeps source imports stable with the @ alias.
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: previewAllowedHosts,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})

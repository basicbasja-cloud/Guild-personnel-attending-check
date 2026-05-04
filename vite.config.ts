import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // Use root path for local dev; use the repo subpath only for production builds (GitHub Pages)
  base: command === 'build' ? '/Guild-personnel-attending-check/' : '/',
}))

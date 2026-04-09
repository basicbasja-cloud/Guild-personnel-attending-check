import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

// Capture commit SHA at build time (falls back gracefully if git is unavailable)
let commitSha = 'unknown'
try {
  commitSha = execSync('git rev-parse HEAD', { stdio: ['pipe', 'pipe', 'ignore'] })
    .toString()
    .trim()
} catch {
  console.warn('[vite] Could not read git SHA — version.json will contain "unknown". Is git installed and is this a git repository?')
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'write-version-json',
      closeBundle() {
        writeFileSync(
          resolve(__dirname, 'dist/version.json'),
          JSON.stringify({ sha: commitSha, buildTime: new Date().toISOString() }, null, 2) + '\n',
        )
      },
    },
  ],
  base: '/Guild-personnel-attending-check/',
})

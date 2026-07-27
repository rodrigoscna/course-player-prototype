import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * GitHub Pages serves a project site from a subpath, so every asset URL has to
 * carry the repository name. `base` feeds `import.meta.env.BASE_URL`, which the
 * router reads as its basename — so the two can never drift apart.
 */
const base = process.env.DEPLOY_BASE ?? '/'

/**
 * A static host has no rewrite rule, so a deep link like /courses/x/lessons/y is
 * a request for a file that does not exist. GitHub Pages answers those with
 * 404.html, and serving a copy of the app there hands the URL to the router
 * intact — clean paths, no hash, no server config.
 */
function spaFallback() {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const dist = resolve(import.meta.dirname, 'dist')
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), spaFallback()],
})

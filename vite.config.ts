import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths so the built app also works from a GitHub Pages subfolder.
  base: './',
  plugins: [react()],
})

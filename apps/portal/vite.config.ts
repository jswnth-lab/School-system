import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev: run `pnpm dev` in apps/api (wrangler, :8787) and here; /api is proxied.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
})

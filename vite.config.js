import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/catalog': {
        target: 'https://displaycatalog.mp.microsoft.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/catalog/, ''),
      },
      '/rates': {
        target: 'https://open.er-api.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rates/, ''),
      },
    },
  },
})

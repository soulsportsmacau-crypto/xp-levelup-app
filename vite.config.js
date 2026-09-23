import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss' // 1. 引入新版 Tailwind PostCSS 插件

// https://vite.dev
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()], // 2. 將插件注入到 CSS 編譯流程中
    },
  },
})

// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import dotenv from 'dotenv'; // ✅ تحميل .env

dotenv.config(); // ✅ تحميل متغيرات البيئة

// https://astro.build/config
export default defineConfig({
  // ✅ المهم: نقول ل Astro إن ملفاتنا في frontend/src بدل src
  srcDir: 'frontend/src',
  output: 'server',
  vite: {
    plugins: [tailwindcss()]
  },
  adapter: vercel()
});

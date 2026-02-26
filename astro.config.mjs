import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://tekabijoux.ro',
  trailingSlash: 'always',
  build: {
    format: 'directory'
  },
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Для GitHub Pages project site:
// https://<username>.github.io/qzomedicalcollege-site-v2/
// Если позже подключишь свой домен, поменяй base на '/'.
export default defineConfig({
  site: 'https://example.github.io',
  base: '/qzomedicalcollege-site-v2',
  trailingSlash: 'never',
  build: {
    format: 'file'
  },
  integrations: [sitemap()]
});

import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://qzomedicalcollege.github.io',
  base: '/qzomedicalcollege-site-v2/',
  trailingSlash: 'never',
  build: {
    format: 'file'
  }
});

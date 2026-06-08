import { defineConfig } from 'astro/config';

// GitHub Pages project site:
// https://qzomedicalcollege.github.io/qzomedicalcollege-site-v2/
// If you later connect a custom domain, change base to '/'.
export default defineConfig({
  site: 'https://qzomedicalcollege.github.io',
  base: '/qzomedicalcollege-site-v2/',
  trailingSlash: 'never',
  build: {
    format: 'file'
  }
});

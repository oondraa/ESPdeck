// @ts-check
import { defineConfig } from 'astro/config';

/**
 * Nasazení:
 *  - Vercel / vlastní doména: nic nenastavuj (base "/").
 *  - GitHub Pages projektu: SITE_URL=https://oondraa.github.io BASE_PATH=/ESPdeck
 */
const site = process.env.SITE_URL ?? 'https://oondraa.github.io';
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  compressHTML: true,
  build: {
    inlineStylesheets: 'always',
    assets: '_assets',
  },
  devToolbar: { enabled: false },
});

import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('./ferma.config.json', import.meta.url), 'utf8'));

export default defineConfig({
  site: cfg.site.url,
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});

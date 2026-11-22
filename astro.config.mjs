import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Uygulama sayfaları (giriş gerektiren) arama motorlarına gösterilmez
const gizli = ['/404', '/giris/', '/koc/', '/hesabim/'];

export default defineConfig({
  site: 'https://beyazyakala.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (page) => !gizli.some((g) => page.includes(g)) })]
});

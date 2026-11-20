# beyazyakala.com

Beyaz Yakala'nın herkese açık web sitesi: tanıtım, ücretsiz araçlar, şablonlar, blog ve koç demosu.

- **Teknoloji:** [Astro](https://astro.build) ile tamamen statik site (her sayfa hazır HTML; arama motorları ve paylaşım önizlemeleri için ideal).
- **Barındırma:** Cloudflare Workers statik varlıklar (ücretsiz plan).
- **Yazı tipleri:** Siteyle birlikte sunulur (Google'a istek gitmez).
- **Çerez / izleme:** Yok.

## Komutlar

```bash
npm install
npm run dev       # yerelde geliştirme: http://localhost:4321
npm run build     # dist/ klasörüne derler
npx wrangler deploy  # Cloudflare'e yayınlar (Workers Builds bunu otomatik yapar)
```

## İçerik nerede?

| Ne | Nerede |
| --- | --- |
| Blog yazıları | `src/blog/*.md` (yeni dosya = yeni yazı; başlık, açıklama, kısa cevap ve SSS dosyanın başında) |
| Şablonlar | `src/data/sablonlar.ts` |
| Menü, site adı | `src/data/site.ts` |
| Kıdem tazminatı tavanı | `src/pages/araclar/kidem-tazminati-hesaplama.astro` içindeki `TAVANLAR` (**her Ocak ve Temmuz güncellenmeli**) |
| Logo, simgeler, paylaşım görselleri | `python3 scripts/gorseller.py <logo.png>` ile üretilir → `public/` |

Yeni blog yazısı eklendiğinde paylaşım görselini üretmek için `scripts/gorseller.py` yeniden çalıştırılmalı.

## Yayın (Cloudflare Workers Builds)

- Build komutu: `npm run build`
- Deploy komutu: `npx wrangler deploy`
- Alan adı: `beyazyakala.com` ve `www.beyazyakala.com` → Worker'a özel alan adı olarak bağlanır.

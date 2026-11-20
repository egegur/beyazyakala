export interface BlogFrontmatter {
  title: string;
  seoTitle: string;
  description: string;
  category: string;
  date: string;
  order: number;
  legal?: boolean;
  shortAnswer: string;
  faq: { q: string; a: string }[];
  cta: string;
  ctaLink: string;
  ctaLabel: string;
}

export interface BlogYazisi {
  slug: string;
  fm: BlogFrontmatter;
  Content: any;
}

const dosyalar = import.meta.glob<{ frontmatter: BlogFrontmatter; Content: any }>('../blog/*.md', { eager: true });

export const yazilar: BlogYazisi[] = Object.entries(dosyalar)
  .map(([yol, mod]) => ({
    slug: yol.split('/').pop()!.replace(/\.md$/, ''),
    fm: mod.frontmatter,
    Content: mod.Content
  }))
  .sort((a, b) => a.fm.order - b.fm.order);

export function tarihYaz(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  return `${d} ${aylar[m - 1]} ${y}`;
}

// Tarayıcı tarafı ortak yardımcılar

export class ApiHatasi extends Error {
  constructor(public mesaj: string, public durum: number, public kod: string) {
    super(mesaj);
  }
}

export async function api<T = any>(yol: string, yontem = 'GET', govde?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(yol, {
      method: yontem,
      headers: govde !== undefined ? { 'content-type': 'application/json' } : {},
      body: govde !== undefined ? JSON.stringify(govde) : undefined,
      credentials: 'same-origin'
    });
  } catch {
    throw new ApiHatasi('Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.', 0, 'ag');
  }
  let v: any = null;
  try {
    v = await r.json();
  } catch {
    /* boş gövde */
  }
  if (!r.ok) {
    if (r.status === 401 && v?.kod === 'giris') girisSayfasinaGit();
    throw new ApiHatasi(v?.hata || 'Beklenmeyen bir hata oldu.', r.status, v?.kod || 'hata');
  }
  return v as T;
}

export function girisSayfasinaGit(): void {
  const d = location.pathname + location.search;
  location.href = `/giris/?d=${encodeURIComponent(d)}`;
}

export function guvenliHedef(d: string | null, varsayilan = '/koc/'): string {
  if (!d || !d.startsWith('/') || d.startsWith('//') || d.includes('\\')) return varsayilan;
  return d;
}

export function kac(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function satirIci(s: string): string {
  // s önceden kaçırılmış olmalı
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
}

/** Koçun kullandığı sade Markdown'ı güvenli HTML'e çevirir */
export function markdown(md: string): string {
  const satirlar = kac(md.replace(/\r/g, '')).split('\n');
  const cikti: string[] = [];
  let liste: 'ul' | 'ol' | null = null;
  let paragraf: string[] = [];
  const paragrafiBitir = () => {
    if (paragraf.length) cikti.push(`<p>${satirIci(paragraf.join('<br>'))}</p>`);
    paragraf = [];
  };
  const listeyiBitir = () => {
    if (liste) cikti.push(`</${liste}>`);
    liste = null;
  };
  for (const ham of satirlar) {
    const s = ham.trimEnd();
    let m: RegExpMatchArray | null;
    if (!s.trim()) {
      paragrafiBitir();
      listeyiBitir();
    } else if ((m = s.match(/^#{1,4}\s+(.*)$/))) {
      paragrafiBitir();
      listeyiBitir();
      cikti.push(`<h3>${satirIci(m[1])}</h3>`);
    } else if ((m = s.match(/^\s*[-•*]\s+(.*)$/))) {
      paragrafiBitir();
      if (liste !== 'ul') {
        listeyiBitir();
        cikti.push('<ul>');
        liste = 'ul';
      }
      cikti.push(`<li>${satirIci(m[1])}</li>`);
    } else if ((m = s.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
      paragrafiBitir();
      if (liste !== 'ol') {
        listeyiBitir();
        cikti.push(`<ol start="${Number(m[1]) || 1}">`);
        liste = 'ol';
      }
      cikti.push(`<li>${satirIci(m[2])}</li>`);
    } else if ((m = s.match(/^&gt;\s?(.*)$/))) {
      paragrafiBitir();
      listeyiBitir();
      cikti.push(`<blockquote>${satirIci(m[1])}</blockquote>`);
    } else {
      if (liste) listeyiBitir();
      paragraf.push(s);
    }
  }
  paragrafiBitir();
  listeyiBitir();
  return cikti.join('');
}

export function tarihYaz(t: number): string {
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function bugunTr(): string {
  return new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
}

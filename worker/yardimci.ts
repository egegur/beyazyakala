import type { Env } from './tipler';

export const GUN_MS = 24 * 60 * 60 * 1000;

export function json(veri: unknown, durum = 200, ekBasliklar: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(veri), {
    status: durum,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...ekBasliklar
    }
  });
}

export function hata(mesaj: string, durum = 400, kod = 'hata'): Response {
  return json({ hata: mesaj, kod }, durum);
}

export function rastgeleId(bayt = 16): string {
  const b = new Uint8Array(bayt);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function rastgeleKod(): string {
  // 6 haneli, önyargısız
  const b = new Uint32Array(1);
  let n: number;
  do {
    crypto.getRandomValues(b);
    n = b[0];
  } while (n >= 4_294_000_000); // 4.294.000.000 / 1.000.000 tam bölünür
  return String(n % 1_000_000).padStart(6, '0');
}

export async function sha256(metin: string): Promise<string> {
  const veri = new TextEncoder().encode(metin);
  const ozet = await crypto.subtle.digest('SHA-256', veri);
  return [...new Uint8Array(ozet)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Türkiye saatine göre gün anahtarı: 2026-11-22 */
export function gunAnahtari(t = Date.now()): string {
  return new Date(t + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function ipAl(istek: Request): string {
  return istek.headers.get('cf-connecting-ip') || istek.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'yerel';
}

/** IP adresini saklamadan, gün bazlı tuzlanmış özetini kullan */
export async function ipOzeti(istek: Request): Promise<string> {
  return (await sha256(`ip:${gunAnahtari()}:${ipAl(istek)}`)).slice(0, 32);
}

export function epostaGecerli(e: string): boolean {
  return e.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/.test(e);
}

export function epostaNormalle(e: unknown): string {
  return String(e ?? '').trim().toLocaleLowerCase('en-US');
}

export async function govdeOku<T = Record<string, unknown>>(istek: Request, sinir = 60_000): Promise<T | null> {
  const metin = await istek.text();
  if (metin.length > sinir) return null;
  try {
    const v = JSON.parse(metin);
    return v && typeof v === 'object' ? (v as T) : null;
  } catch {
    return null;
  }
}

export function metinAl(v: unknown, sinir: number): string {
  return String(v ?? '').replace(/\u0000/g, '').trim().slice(0, sinir);
}

export function htmlKac(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Sitenin kendi kökeninden gelmeyen değiştirici istekleri reddet (CSRF) */
export function kokenUygun(istek: Request): boolean {
  if (istek.method === 'GET' || istek.method === 'HEAD') return true;
  const koken = istek.headers.get('origin');
  if (!koken) return false;
  try {
    return new URL(koken).host === new URL(istek.url).host;
  } catch {
    return false;
  }
}

export function sayi(v: string | undefined, varsayilan: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : varsayilan;
}

export function gelistirmeMi(env: Env): boolean {
  return env.GELISTIRME === '1';
}

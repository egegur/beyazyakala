import type { Env, Kullanici } from './tipler';
import { bakim, semaKur } from './veritabani';
import { cikis, hesapSil, kodDogrula, kodGonder, oturumKullanici } from './uyelik';
import { ben, mesajGonder, profilKaydet, sohbetDetay, sohbetListesi, sohbetSil } from './koc';
import { adimEkle, adimGuncelle, adimListesi, adimSil, hafizaEkle, hafizaListesi, hafizaSil, hatirlatmalar, verileriIndir } from './takip';
import { atsKontrol, tonKontrol } from './araclar';
import { hata, json, kokenUygun } from './yardimci';

type Isleyici = (a: {
  env: Env;
  istek: Request;
  ctx: ExecutionContext;
  k: Kullanici | null;
  p: string[];
}) => Promise<Response>;

interface Rota {
  yontem: string;
  desen: RegExp;
  giris: boolean;
  is: Isleyici;
}

const r = (yontem: string, desen: string, giris: boolean, is: Isleyici): Rota => ({
  yontem,
  desen: new RegExp(`^${desen}$`),
  giris,
  is
});
const ID = '([a-f0-9]{32})';

const ROTALAR: Rota[] = [
  r('GET', '/api/durum', false, async ({ env }) =>
    json({ koc: !!env.ANTHROPIC_API_KEY, eposta: !!env.RESEND_API_KEY, turnstile: env.TURNSTILE_SITE_KEY || null })
  ),
  r('POST', '/api/giris/kod', false, ({ env, istek }) => kodGonder(env, istek)),
  r('POST', '/api/giris/dogrula', false, ({ env, istek }) => kodDogrula(env, istek)),
  r('POST', '/api/cikis', false, ({ env, istek }) => cikis(env, istek)),
  r('GET', '/api/ben', true, ({ env, k }) => ben(env, k!)),
  r('PUT', '/api/profil', true, ({ env, istek, k }) => profilKaydet(env, istek, k!)),
  r('GET', '/api/sohbetler', true, ({ env, k }) => sohbetListesi(env, k!)),
  r('GET', `/api/sohbetler/${ID}`, true, ({ env, k, p }) => sohbetDetay(env, k!, p[0])),
  r('DELETE', `/api/sohbetler/${ID}`, true, ({ env, k, p }) => sohbetSil(env, k!, p[0])),
  r('POST', '/api/sohbet', true, ({ env, istek, k, ctx }) => mesajGonder(env, istek, k!, ctx)),
  r('GET', '/api/adimlar', true, ({ env, k }) => adimListesi(env, k!)),
  r('POST', '/api/adimlar', true, ({ env, istek, k }) => adimEkle(env, istek, k!)),
  r('PATCH', `/api/adimlar/${ID}`, true, ({ env, istek, k, p }) => adimGuncelle(env, istek, k!, p[0])),
  r('DELETE', `/api/adimlar/${ID}`, true, ({ env, k, p }) => adimSil(env, k!, p[0])),
  r('GET', '/api/hafiza', true, ({ env, k }) => hafizaListesi(env, k!)),
  r('POST', '/api/hafiza', true, ({ env, istek, k }) => hafizaEkle(env, istek, k!)),
  r('DELETE', `/api/hafiza/${ID}`, true, ({ env, k, p }) => hafizaSil(env, k!, p[0])),
  r('GET', '/api/verilerim', true, ({ env, k }) => verileriIndir(env, k!)),
  r('DELETE', '/api/hesap', true, ({ env, istek, k }) => hesapSil(env, istek, k!)),
  r('POST', '/api/arac/ton', false, ({ env, istek, k }) => tonKontrol(env, istek, k)),
  r('POST', '/api/arac/ats', false, ({ env, istek, k }) => atsKontrol(env, istek, k))
];

async function api(istek: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(istek.url);
  if (!kokenUygun(istek)) return hata('İzin verilmeyen kaynak.', 403, 'koken');
  await semaKur(env);
  let yolUydu = false;
  for (const rota of ROTALAR) {
    const m = rota.desen.exec(url.pathname);
    if (!m) continue;
    yolUydu = true;
    if (rota.yontem !== istek.method) continue;
    const k = await oturumKullanici(env, istek);
    if (rota.giris && !k) return hata('Oturumun kapanmış. Tekrar giriş yap.', 401, 'giris');
    return rota.is({ env, istek, ctx, k, p: m.slice(1) });
  }
  return yolUydu ? hata('Yöntem desteklenmiyor.', 405) : hata('Bulunamadı.', 404);
}

const GUVENLIK_BASLIKLARI: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()'
};

export default {
  async fetch(istek: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(istek.url);
    if (url.pathname.startsWith('/api/')) {
      let yanit: Response;
      try {
        yanit = await api(istek, env, ctx);
      } catch (e) {
        console.error('api hatası', url.pathname, String(e));
        yanit = hata('Beklenmeyen bir hata oldu. Birazdan tekrar dene.', 500);
      }
      const h = new Headers(yanit.headers);
      for (const [a, d] of Object.entries(GUVENLIK_BASLIKLARI)) h.set(a, d);
      return new Response(yanit.body, { status: yanit.status, headers: h });
    }
    return env.ASSETS.fetch(istek);
  },

  async scheduled(_olay: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        await bakim(env);
        const n = await hatirlatmalar(env);
        console.log(`bakım tamam, ${n} hatırlatma gönderildi`);
      })()
    );
  }
} satisfies ExportedHandler<Env>;

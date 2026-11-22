import type { Env, Kullanici } from './tipler';
import { epostaGonder, kodEpostasi } from './eposta';
import { kullaniciSil, sayacArtir } from './veritabani';
import {
  GUN_MS, epostaGecerli, epostaNormalle, govdeOku, gunAnahtari, hata, ipAl, ipOzeti, json,
  rastgeleId, rastgeleKod, sha256, gelistirmeMi
} from './yardimci';

export const RIZA_SURUM = '2026-11-22';
const CEREZ = 'by_oturum';
const OTURUM_GUN = 30;
const KOD_SURE_MS = 10 * 60 * 1000;

function cerezOku(istek: Request): string | null {
  const c = istek.headers.get('cookie') || '';
  for (const parca of c.split(';')) {
    const [ad, ...deger] = parca.trim().split('=');
    if (ad === CEREZ) return deger.join('=') || null;
  }
  return null;
}

function cerezYaz(istek: Request, token: string, saniye: number): string {
  const guvenli = new URL(istek.url).protocol === 'https:' ? '; Secure' : '';
  return `${CEREZ}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${saniye}${guvenli}`;
}

/** Arayüzün giriş durumunu bilmesi için içeriksiz işaret çerezi (oturum bilgisi taşımaz) */
function isaretCerezi(istek: Request, acik: boolean, saniye: number): string {
  const guvenli = new URL(istek.url).protocol === 'https:' ? '; Secure' : '';
  return `by_g=${acik ? '1' : ''}; Path=/; SameSite=Lax; Max-Age=${acik ? saniye : 0}${guvenli}`;
}

function cerezli(veri: unknown, cerezler: string[]): Response {
  const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  for (const c of cerezler) h.append('set-cookie', c);
  return new Response(JSON.stringify(veri), { headers: h });
}

export async function oturumKullanici(env: Env, istek: Request): Promise<Kullanici | null> {
  const token = cerezOku(istek);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const ozet = await sha256(`oturum:${token}`);
  const r = await env.DB.prepare(
    `SELECT k.id, k.eposta, k.profil, k.hatirlatma, k.haftalik, o.bitis
     FROM oturumlar o JOIN kullanicilar k ON k.id = o.kullanici_id
     WHERE o.token_ozeti = ?`
  )
    .bind(ozet)
    .first<Kullanici & { bitis: number }>();
  if (!r || r.bitis < Date.now()) return null;
  return { id: r.id, eposta: r.eposta, profil: r.profil, hatirlatma: r.hatirlatma, haftalik: r.haftalik };
}

async function turnstileDogrula(env: Env, istek: Request, token: unknown): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true; // yapılandırılmadıysa atla
  if (typeof token !== 'string' || !token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  form.append('remoteip', ipAl(istek));
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const v = (await r.json()) as { success?: boolean };
  return !!v.success;
}

/** POST /api/giris/kod */
export async function kodGonder(env: Env, istek: Request): Promise<Response> {
  const g = await govdeOku(istek, 4000);
  if (!g) return hata('Geçersiz istek.');
  const eposta = epostaNormalle(g.eposta);
  if (!epostaGecerli(eposta)) return hata('Geçerli bir e-posta adresi yaz.', 400, 'eposta');

  const mevcut = await env.DB.prepare(`SELECT id FROM kullanicilar WHERE eposta = ?`).bind(eposta).first();
  if (!mevcut && (g.rizaKvkk !== true || g.rizaYurtdisi !== true)) {
    return hata('Devam etmek için aydınlatma metnini okuduğunu ve yurt dışına aktarıma onay verdiğini işaretlemelisin.', 400, 'riza');
  }
  if (!(await turnstileDogrula(env, istek, g.turnstile))) return hata('Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar dene.', 400, 'turnstile');

  const gun = gunAnahtari();
  const ip = await ipOzeti(istek);
  const epostaOzet = (await sha256(`e:${eposta}`)).slice(0, 32);
  // Sınırlar: e-posta başına 10 dk'da 3, günde 8; IP başına günde 15; toplam günde 80 (Resend ücretsiz: 100/gün)
  const onDk = Math.floor(Date.now() / (10 * 60 * 1000));
  const [eKisa, eGun, ipGun, toplam] = await Promise.all([
    sayacArtir(env, `kod:e10:${epostaOzet}:${onDk}`),
    sayacArtir(env, `kod:e:${epostaOzet}:${gun}`),
    sayacArtir(env, `kod:ip:${ip}:${gun}`),
    sayacArtir(env, `eposta:toplam:${gun}`)
  ]);
  if (eKisa > 3 || eGun > 8 || ipGun > 15) {
    return hata('Çok fazla kod istendi. Biraz bekleyip tekrar dene.', 429, 'sinir');
  }
  if (toplam > 80) {
    return hata('Beta döneminde günlük giriş kapasitemiz doldu. Yarın tekrar dene.', 429, 'kapasite');
  }

  const kod = rastgeleKod();
  const kodOzeti = await sha256(`kod:${eposta}:${kod}`);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO giris_kodlari (eposta, kod_ozeti, bitis, deneme) VALUES (?, ?, ?, 0)`
  )
    .bind(eposta, kodOzeti, Date.now() + KOD_SURE_MS)
    .run();

  if (gelistirmeMi(env)) {
    console.log(`[geliştirme] ${eposta} için giriş kodu: ${kod}`);
  }
  const e = kodEpostasi(kod);
  const gitti = await epostaGonder(env, { ...e, kime: eposta });
  if (!gitti && !gelistirmeMi(env)) {
    return hata('Kodu şu an gönderemedik. Birkaç dakika sonra tekrar dene.', 502, 'eposta-gonderilemedi');
  }
  return json({ tamam: true, yeni: !mevcut });
}

/** POST /api/giris/dogrula */
export async function kodDogrula(env: Env, istek: Request): Promise<Response> {
  const g = await govdeOku(istek, 4000);
  if (!g) return hata('Geçersiz istek.');
  const eposta = epostaNormalle(g.eposta);
  const kod = String(g.kod ?? '').replace(/\D/g, '');
  if (!epostaGecerli(eposta) || kod.length !== 6) return hata('Kodu 6 rakam olarak yaz.', 400, 'kod');

  const kayit = await env.DB.prepare(`SELECT kod_ozeti, bitis, deneme FROM giris_kodlari WHERE eposta = ?`)
    .bind(eposta)
    .first<{ kod_ozeti: string; bitis: number; deneme: number }>();
  if (!kayit || kayit.bitis < Date.now()) return hata('Kodun süresi dolmuş. Yeni kod iste.', 400, 'sure');
  if (kayit.deneme >= 5) {
    await env.DB.prepare(`DELETE FROM giris_kodlari WHERE eposta = ?`).bind(eposta).run();
    return hata('Çok fazla hatalı deneme. Yeni kod iste.', 429, 'deneme');
  }
  const ozet = await sha256(`kod:${eposta}:${kod}`);
  if (ozet !== kayit.kod_ozeti) {
    await env.DB.prepare(`UPDATE giris_kodlari SET deneme = deneme + 1 WHERE eposta = ?`).bind(eposta).run();
    return hata('Kod hatalı. Tekrar dene.', 400, 'kod');
  }
  await env.DB.prepare(`DELETE FROM giris_kodlari WHERE eposta = ?`).bind(eposta).run();

  const simdi = Date.now();
  let k = await env.DB.prepare(`SELECT id FROM kullanicilar WHERE eposta = ?`).bind(eposta).first<{ id: string }>();
  let yeni = false;
  if (!k) {
    if (g.rizaKvkk !== true || g.rizaYurtdisi !== true) return hata('Onay kutuları işaretlenmeli.', 400, 'riza');
    const id = rastgeleId();
    await env.DB.prepare(
      `INSERT INTO kullanicilar (id, eposta, olusturma, son_giris, riza_kvkk, riza_yurtdisi, riza_surum)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, eposta, simdi, simdi, simdi, simdi, RIZA_SURUM)
      .run();
    k = { id };
    yeni = true;
  } else {
    await env.DB.prepare(`UPDATE kullanicilar SET son_giris = ? WHERE id = ?`).bind(simdi, k.id).run();
  }

  const token = rastgeleId(32);
  await env.DB.prepare(`INSERT INTO oturumlar (token_ozeti, kullanici_id, bitis) VALUES (?, ?, ?)`)
    .bind(await sha256(`oturum:${token}`), k.id, simdi + OTURUM_GUN * GUN_MS)
    .run();
  return cerezli({ tamam: true, yeni }, [cerezYaz(istek, token, OTURUM_GUN * 86400), isaretCerezi(istek, true, OTURUM_GUN * 86400)]);
}

/** POST /api/cikis */
export async function cikis(env: Env, istek: Request): Promise<Response> {
  const token = cerezOku(istek);
  if (token) await env.DB.prepare(`DELETE FROM oturumlar WHERE token_ozeti = ?`).bind(await sha256(`oturum:${token}`)).run();
  return cerezli({ tamam: true }, [cerezYaz(istek, '', 0), isaretCerezi(istek, false, 0)]);
}

/** DELETE /api/hesap */
export async function hesapSil(env: Env, istek: Request, k: Kullanici): Promise<Response> {
  await kullaniciSil(env, k.id);
  return cerezli({ tamam: true }, [cerezYaz(istek, '', 0), isaretCerezi(istek, false, 0)]);
}

import type { Env, Kullanici } from './tipler';
import { adimEpostasi, epostaGonder } from './eposta';
import { profilOku } from './koc';
import { sayacArtir } from './veritabani';
import { govdeOku, gunAnahtari, hata, json, metinAl, rastgeleId } from './yardimci';

const TARIH = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- Adımlar ---------- */

export async function adimListesi(env: Env, k: Kullanici): Promise<Response> {
  const r = await env.DB.prepare(
    `SELECT id, sohbet_id, metin, tarih, durum FROM adimlar WHERE kullanici_id = ?
     ORDER BY durum = 'tamam', COALESCE(tarih, '9999'), olusturma DESC LIMIT 200`
  )
    .bind(k.id)
    .all();
  return json({ adimlar: r.results });
}

export async function adimEkle(env: Env, istek: Request, k: Kullanici): Promise<Response> {
  const g = await govdeOku(istek, 4000);
  const metin = metinAl(g?.metin, 200);
  if (!metin) return hata('Adım boş olamaz.');
  const sayi = await env.DB.prepare(`SELECT COUNT(*) AS n FROM adimlar WHERE kullanici_id = ? AND durum = 'acik'`)
    .bind(k.id)
    .first<{ n: number }>();
  if ((sayi?.n ?? 0) >= 50) return hata('En fazla 50 açık adımın olabilir. Bazılarını tamamla veya sil.');
  const tarih = typeof g?.tarih === 'string' && TARIH.test(g.tarih) ? g.tarih : null;
  const sohbetId = typeof g?.sohbetId === 'string' ? g.sohbetId.slice(0, 64) : null;
  const id = rastgeleId();
  await env.DB.prepare(
    `INSERT INTO adimlar (id, kullanici_id, sohbet_id, metin, tarih, durum, olusturma) VALUES (?, ?, ?, ?, ?, 'acik', ?)`
  )
    .bind(id, k.id, sohbetId, metin, tarih, Date.now())
    .run();
  return json({ tamam: true, id });
}

export async function adimGuncelle(env: Env, istek: Request, k: Kullanici, id: string): Promise<Response> {
  const g = await govdeOku(istek, 4000);
  if (!g) return hata('Geçersiz istek.');
  const mevcut = await env.DB.prepare(`SELECT id FROM adimlar WHERE id = ? AND kullanici_id = ?`).bind(id, k.id).first();
  if (!mevcut) return hata('Adım bulunamadı.', 404);
  if (g.durum === 'tamam' || g.durum === 'acik') {
    await env.DB.prepare(`UPDATE adimlar SET durum = ?, tamamlanma = ? WHERE id = ?`)
      .bind(g.durum, g.durum === 'tamam' ? Date.now() : null, id)
      .run();
  }
  if ('tarih' in g) {
    const tarih = typeof g.tarih === 'string' && TARIH.test(g.tarih) ? g.tarih : null;
    await env.DB.prepare(`UPDATE adimlar SET tarih = ? WHERE id = ?`).bind(tarih, id).run();
  }
  return json({ tamam: true });
}

export async function adimSil(env: Env, k: Kullanici, id: string): Promise<Response> {
  await env.DB.prepare(`DELETE FROM adimlar WHERE id = ? AND kullanici_id = ?`).bind(id, k.id).run();
  return json({ tamam: true });
}

/* ---------- Hafıza ---------- */

export async function hafizaListesi(env: Env, k: Kullanici): Promise<Response> {
  const r = await env.DB.prepare(`SELECT id, metin, olusturma FROM hafiza WHERE kullanici_id = ? ORDER BY olusturma DESC`)
    .bind(k.id)
    .all();
  return json({ hafiza: r.results });
}

export async function hafizaEkle(env: Env, istek: Request, k: Kullanici): Promise<Response> {
  const g = await govdeOku(istek, 4000);
  const metin = metinAl(g?.metin, 200);
  if (!metin) return hata('Not boş olamaz.');
  const sayi = await env.DB.prepare(`SELECT COUNT(*) AS n FROM hafiza WHERE kullanici_id = ?`).bind(k.id).first<{ n: number }>();
  if ((sayi?.n ?? 0) >= 20) return hata('En fazla 20 not saklayabilirsin. Eskilerden birini sil.');
  const ayni = await env.DB.prepare(`SELECT id FROM hafiza WHERE kullanici_id = ? AND metin = ?`).bind(k.id, metin).first();
  if (ayni) return json({ tamam: true });
  await env.DB.prepare(`INSERT INTO hafiza (id, kullanici_id, metin, olusturma) VALUES (?, ?, ?, ?)`)
    .bind(rastgeleId(), k.id, metin, Date.now())
    .run();
  return json({ tamam: true });
}

export async function hafizaSil(env: Env, k: Kullanici, id: string): Promise<Response> {
  await env.DB.prepare(`DELETE FROM hafiza WHERE id = ? AND kullanici_id = ?`).bind(id, k.id).run();
  return json({ tamam: true });
}

/* ---------- Verilerim (KVKK md. 11) ---------- */

export async function verileriIndir(env: Env, k: Kullanici): Promise<Response> {
  const [kul, sohbet, mesaj, haf, adim] = await Promise.all([
    env.DB.prepare(`SELECT eposta, olusturma, son_giris, riza_kvkk, riza_yurtdisi, riza_surum, profil, hatirlatma, haftalik FROM kullanicilar WHERE id = ?`).bind(k.id).first(),
    env.DB.prepare(`SELECT id, baslik, alan, olusturma, guncelleme FROM sohbetler WHERE kullanici_id = ?`).bind(k.id).all(),
    env.DB.prepare(`SELECT m.sohbet_id, m.rol, m.metin, m.olusturma FROM mesajlar m JOIN sohbetler s ON s.id = m.sohbet_id WHERE s.kullanici_id = ? ORDER BY m.id`).bind(k.id).all(),
    env.DB.prepare(`SELECT metin, olusturma FROM hafiza WHERE kullanici_id = ?`).bind(k.id).all(),
    env.DB.prepare(`SELECT metin, tarih, durum, olusturma, tamamlanma FROM adimlar WHERE kullanici_id = ?`).bind(k.id).all()
  ]);
  const veri = {
    aciklama: 'Beyaz Yakala hesabında saklanan tüm verilerin. Zamanlar milisaniye cinsinden Unix zamanıdır.',
    indirme: new Date().toISOString(),
    hesap: kul ? { ...kul, profil: profilOku({ ...k, profil: String((kul as any).profil) }) } : null,
    sohbetler: sohbet.results,
    mesajlar: mesaj.results,
    hafiza: haf.results,
    adimlar: adim.results
  };
  return new Response(JSON.stringify(veri, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="beyazyakala-verilerim-${gunAnahtari()}.json"`,
      'cache-control': 'no-store'
    }
  });
}

/* ---------- Zamanlanmış e-postalar ---------- */

/** Her sabah: bugün tarihli adımlar için hatırlatma; pazartesi: haftalık özet. Günlük e-posta kotasını korur. */
export async function hatirlatmalar(env: Env, kota = 30): Promise<number> {
  const bugun = gunAnahtari();
  const pazartesi = new Date(`${bugun}T12:00:00Z`).getUTCDay() === 1;
  let gonderilen = 0;

  const bugunku = await env.DB.prepare(
    `SELECT k.id, k.eposta, a.metin, a.tarih FROM adimlar a JOIN kullanicilar k ON k.id = a.kullanici_id
     WHERE a.durum = 'acik' AND a.tarih = ? AND k.hatirlatma = 1 ORDER BY k.id`
  )
    .bind(bugun)
    .all<{ id: string; eposta: string; metin: string; tarih: string }>();
  const grup = new Map<string, { eposta: string; adimlar: { metin: string; tarih: string | null }[] }>();
  for (const r of bugunku.results) {
    if (!grup.has(r.id)) grup.set(r.id, { eposta: r.eposta, adimlar: [] });
    grup.get(r.id)!.adimlar.push({ metin: r.metin, tarih: null });
  }
  for (const [, v] of grup) {
    if (gonderilen >= kota) break;
    if ((await sayacArtir(env, `eposta:toplam:${bugun}`)) > 40) break;
    const e = adimEpostasi('Bugün için planladığın adım', 'Bugün yapmayı planladığın adımları hatırlatmak istedim:', v.adimlar);
    if (await epostaGonder(env, { ...e, kime: v.eposta })) gonderilen++;
  }

  if (pazartesi) {
    const haftalik = await env.DB.prepare(
      `SELECT k.id, k.eposta FROM kullanicilar k WHERE k.haftalik = 1
       AND EXISTS (SELECT 1 FROM adimlar a WHERE a.kullanici_id = k.id AND a.durum = 'acik')`
    ).all<{ id: string; eposta: string }>();
    for (const u of haftalik.results) {
      if (gonderilen >= kota) break;
      if ((await sayacArtir(env, `eposta:toplam:${bugun}`)) > 40) break;
      const a = await env.DB.prepare(
        `SELECT metin, tarih FROM adimlar WHERE kullanici_id = ? AND durum = 'acik' ORDER BY COALESCE(tarih, '9999') LIMIT 5`
      )
        .bind(u.id)
        .all<{ metin: string; tarih: string | null }>();
      const e = adimEpostasi('Bu haftanın kariyer adımları', 'Yeni haftaya başlarken açık adımların:', a.results);
      if (await epostaGonder(env, { ...e, kime: u.eposta })) gonderilen++;
    }
  }
  return gonderilen;
}

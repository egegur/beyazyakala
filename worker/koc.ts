import type { Env, Kullanici } from './tipler';
import { KOC_TALIMATI } from './talimatlar';
import { akisla, butceVarMi, type Mesaj } from './yapayzeka';
import { sayacArtir, sayacOku } from './veritabani';
import { govdeOku, gunAnahtari, hata, json, metinAl, rastgeleId, sayi } from './yardimci';

export const ALANLAR: Record<string, string> = {
  beklenti: 'Şirket beklentileri',
  yonetici: 'Yöneticiyle ilişki',
  gelisim: 'Kendini geliştirme',
  yukselme: 'Yükselme (zam, terfi)',
  degisim: 'Kariyer değişimi',
  ayrilik: 'İşten çıkarılma ve ayrılık',
  zorlu: 'Zorlu ortam ve mobbing'
};

const PROFIL_ALANLARI = ['rol', 'sektor', 'kidem', 'sirket_buyuklugu', 'hedef'] as const;
const PROFIL_ETIKET: Record<string, string> = {
  rol: 'Rolü',
  sektor: 'Sektörü',
  kidem: 'Toplam deneyimi',
  sirket_buyuklugu: 'Şirket büyüklüğü',
  hedef: 'Şu anki hedefi'
};
const MESAJ_SINIRI = 4000;
const GECMIS_MESAJ = 16;
const EK_ISARETI = '[[EK]]';

export function profilOku(k: Kullanici): Record<string, string> {
  try {
    const p = JSON.parse(k.profil || '{}');
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

export async function gunlukKalan(env: Env, k: Kullanici): Promise<number> {
  const kullanilan = await sayacOku(env, `koc:u:${k.id}:${gunAnahtari()}`);
  return Math.max(0, sayi(env.KOC_GUNLUK_MESAJ, 25) - kullanilan);
}

/** GET /api/ben */
export async function ben(env: Env, k: Kullanici): Promise<Response> {
  return json({
    eposta: k.eposta,
    profil: profilOku(k),
    hatirlatma: !!k.hatirlatma,
    haftalik: !!k.haftalik,
    kalan: await gunlukKalan(env, k),
    alanlar: ALANLAR
  });
}

/** PUT /api/profil */
export async function profilKaydet(env: Env, istek: Request, k: Kullanici): Promise<Response> {
  const g = await govdeOku(istek, 8000);
  if (!g) return hata('Geçersiz istek.');
  const p: Record<string, string> = {};
  for (const a of PROFIL_ALANLARI) {
    const v = metinAl((g.profil as Record<string, unknown> | undefined)?.[a], 160);
    if (v) p[a] = v;
  }
  const hatirlatma = g.hatirlatma === true ? 1 : 0;
  const haftalik = g.haftalik === true ? 1 : 0;
  await env.DB.prepare(`UPDATE kullanicilar SET profil = ?, hatirlatma = ?, haftalik = ? WHERE id = ?`)
    .bind(JSON.stringify(p), hatirlatma, haftalik, k.id)
    .run();
  return json({ tamam: true });
}

/** GET /api/sohbetler */
export async function sohbetListesi(env: Env, k: Kullanici): Promise<Response> {
  const r = await env.DB.prepare(
    `SELECT id, baslik, alan, guncelleme FROM sohbetler WHERE kullanici_id = ? ORDER BY guncelleme DESC LIMIT 100`
  )
    .bind(k.id)
    .all();
  return json({ sohbetler: r.results });
}

async function sohbetGetir(env: Env, k: Kullanici, id: string) {
  return env.DB.prepare(`SELECT id, baslik, alan FROM sohbetler WHERE id = ? AND kullanici_id = ?`)
    .bind(id, k.id)
    .first<{ id: string; baslik: string; alan: string | null }>();
}

/** GET /api/sohbetler/:id */
export async function sohbetDetay(env: Env, k: Kullanici, id: string): Promise<Response> {
  const s = await sohbetGetir(env, k, id);
  if (!s) return hata('Sohbet bulunamadı.', 404);
  const m = await env.DB.prepare(`SELECT id, rol, metin, ek FROM mesajlar WHERE sohbet_id = ? ORDER BY id`).bind(id).all<{
    id: number;
    rol: string;
    metin: string;
    ek: string | null;
  }>();
  return json({
    sohbet: s,
    mesajlar: m.results.map((x) => ({ id: x.id, rol: x.rol, metin: x.metin, ek: x.ek ? JSON.parse(x.ek) : null }))
  });
}

/** DELETE /api/sohbetler/:id */
export async function sohbetSil(env: Env, k: Kullanici, id: string): Promise<Response> {
  const s = await sohbetGetir(env, k, id);
  if (!s) return hata('Sohbet bulunamadı.', 404);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM mesajlar WHERE sohbet_id = ?`).bind(id),
    env.DB.prepare(`UPDATE adimlar SET sohbet_id = NULL WHERE sohbet_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM sohbetler WHERE id = ?`).bind(id)
  ]);
  return json({ tamam: true });
}

function ekAyir(tam: string): { gorunen: string; ek: { adimlar: string[]; hafiza: string[] } } {
  const i = tam.indexOf(EK_ISARETI);
  const bos = { adimlar: [] as string[], hafiza: [] as string[] };
  if (i === -1) return { gorunen: tam.trim(), ek: bos };
  const gorunen = tam.slice(0, i).trim();
  const ham = tam.slice(i + EK_ISARETI.length);
  try {
    const bas = ham.indexOf('{');
    const son = ham.lastIndexOf('}');
    const v = JSON.parse(ham.slice(bas, son + 1));
    const temizle = (x: unknown) =>
      Array.isArray(x) ? x.map((s) => metinAl(s, 160)).filter(Boolean).slice(0, 3) : [];
    return { gorunen, ek: { adimlar: temizle(v.adimlar), hafiza: temizle(v.hafiza).slice(0, 2) } };
  } catch {
    return { gorunen, ek: bos };
  }
}

async function baglamMetni(env: Env, k: Kullanici, alan: string | null): Promise<string> {
  const p = profilOku(k);
  const satirlar: string[] = [];
  const profilSatir = PROFIL_ALANLARI.filter((a) => p[a]).map((a) => `- ${PROFIL_ETIKET[a]}: ${p[a]}`);
  if (profilSatir.length) satirlar.push('## Kullanıcının profili (kendi girdi)', ...profilSatir);
  const h = await env.DB.prepare(`SELECT metin FROM hafiza WHERE kullanici_id = ? ORDER BY olusturma DESC LIMIT 20`)
    .bind(k.id)
    .all<{ metin: string }>();
  if (h.results.length) satirlar.push('## Kullanıcının kaydetmeyi onayladığı notlar', ...h.results.map((x) => `- ${x.metin}`));
  const a = await env.DB.prepare(
    `SELECT metin, tarih FROM adimlar WHERE kullanici_id = ? AND durum = 'acik' ORDER BY olusturma DESC LIMIT 10`
  )
    .bind(k.id)
    .all<{ metin: string; tarih: string | null }>();
  if (a.results.length)
    satirlar.push('## Kullanıcının açık adımları', ...a.results.map((x) => `- ${x.metin}${x.tarih ? ` (tarih: ${x.tarih})` : ''}`));
  if (alan && ALANLAR[alan]) satirlar.push(`## Kullanıcının seçtiği alan: ${ALANLAR[alan]}`);
  satirlar.push(`## Bugünün tarihi: ${gunAnahtari()}`);
  return `# Kullanıcı bağlamı\n${satirlar.join('\n')}`;
}

/**
 * POST /api/sohbet  { sohbetId?, alan?, metin }
 * Yanıt: text/event-stream; olaylar: {sohbetId} · {t:"parça"} · {son:true, ek, mesajId} · {hata}
 */
export async function mesajGonder(env: Env, istek: Request, k: Kullanici, ctx: ExecutionContext): Promise<Response> {
  const g = await govdeOku(istek, 20_000);
  if (!g) return hata('Geçersiz istek.');
  const metin = metinAl(g.metin, MESAJ_SINIRI + 1);
  if (!metin) return hata('Bir şeyler yaz.');
  if (metin.length > MESAJ_SINIRI) return hata(`Mesaj en fazla ${MESAJ_SINIRI} karakter olabilir.`);
  if (!env.ANTHROPIC_API_KEY) return hata('Koç şu an bakımda. Kısa süre sonra tekrar dene.', 503, 'anahtar-yok');

  if ((await gunlukKalan(env, k)) <= 0)
    return hata('Bugünlük mesaj hakkın doldu. Yarın kaldığımız yerden devam edelim.', 429, 'gunluk-sinir');
  if (!(await butceVarMi(env)))
    return hata('Beta döneminde bugünkü kapasitemiz doldu. Yarın tekrar dene; sohbetin kayıtlı.', 429, 'butce');

  const simdi = Date.now();
  let sohbetId = typeof g.sohbetId === 'string' ? g.sohbetId : '';
  let alan = typeof g.alan === 'string' && ALANLAR[g.alan] ? g.alan : null;
  if (sohbetId) {
    const s = await sohbetGetir(env, k, sohbetId);
    if (!s) return hata('Sohbet bulunamadı.', 404);
    alan = s.alan;
  } else {
    sohbetId = rastgeleId();
    const baslik = metin.replace(/\s+/g, ' ').slice(0, 70) + (metin.length > 70 ? '…' : '');
    await env.DB.prepare(
      `INSERT INTO sohbetler (id, kullanici_id, baslik, alan, olusturma, guncelleme) VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(sohbetId, k.id, baslik, alan, simdi, simdi)
      .run();
  }

  // Geçmiş (son N mesaj) + yeni mesaj
  const gecmis = await env.DB.prepare(
    `SELECT rol, metin FROM mesajlar WHERE sohbet_id = ? ORDER BY id DESC LIMIT ?`
  )
    .bind(sohbetId, GECMIS_MESAJ)
    .all<{ rol: 'user' | 'assistant'; metin: string }>();
  const mesajlar: Mesaj[] = gecmis.results.reverse().map((m) => ({ role: m.rol, content: m.metin.slice(0, 8000) }));
  while (mesajlar.length && mesajlar[0].role !== 'user') mesajlar.shift();
  mesajlar.push({ role: 'user', content: metin });
  // Önceki bir hata yüzünden art arda aynı rolden mesaj varsa birleştir
  for (let i = mesajlar.length - 1; i > 0; i--) {
    if (mesajlar[i].role === mesajlar[i - 1].role) {
      mesajlar[i - 1] = { role: mesajlar[i].role, content: `${mesajlar[i - 1].content}\n\n${mesajlar[i].content}` };
      mesajlar.splice(i, 1);
    }
  }

  await env.DB.prepare(`INSERT INTO mesajlar (sohbet_id, rol, metin, olusturma) VALUES (?, 'user', ?, ?)`)
    .bind(sohbetId, metin, simdi)
    .run();
  await sayacArtir(env, `koc:u:${k.id}:${gunAnahtari()}`);

  const baglam = await baglamMetni(env, k, alan);
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const yazici = writable.getWriter();
  const kod = new TextEncoder();
  const gonder = (v: unknown) => yazici.write(kod.encode(`data: ${JSON.stringify(v)}\n\n`));

  ctx.waitUntil(
    (async () => {
      try {
        await gonder({ sohbetId });
        // [[EK]] bloğu istemciye akmasın: işareti görene dek bekleyen kısmı tut
        let gonderilen = 0;
        let tam = '';
        const sonuc = await akisla(
          env,
          'koc',
          KOC_TALIMATI,
          mesajlar,
          3000,
          async (parca) => {
            tam += parca;
            const i = tam.indexOf(EK_ISARETI);
            const guvenliSon = i !== -1 ? i : Math.max(gonderilen, tam.length - EK_ISARETI.length);
            if (guvenliSon > gonderilen) {
              await gonder({ t: tam.slice(gonderilen, guvenliSon) });
              gonderilen = guvenliSon;
            }
          },
          baglam
        );
        const { gorunen, ek } = ekAyir(sonuc.metin);
        if (gorunen.length > gonderilen) await gonder({ t: gorunen.slice(gonderilen) });
        const kesik = sonuc.durma === 'max_tokens';
        const kayit = await env.DB.prepare(
          `INSERT INTO mesajlar (sohbet_id, rol, metin, ek, olusturma) VALUES (?, 'assistant', ?, ?, ?) RETURNING id`
        )
          .bind(sohbetId, gorunen || '…', JSON.stringify(ek), Date.now())
          .first<{ id: number }>();
        await env.DB.prepare(`UPDATE sohbetler SET guncelleme = ? WHERE id = ?`).bind(Date.now(), sohbetId).run();
        await gonder({ son: true, ek, mesajId: kayit?.id, kesik, kalan: await gunlukKalan(env, k) });
      } catch (e) {
        console.error('koç hatası', String(e));
        await gonder({ hata: 'Koça şu an ulaşamadık. Mesajın kaydedildi; birazdan tekrar dene.' });
      } finally {
        await yazici.close();
      }
    })()
  );

  return new Response(readable, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no'
    }
  });
}

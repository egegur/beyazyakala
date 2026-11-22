import type { Env, Kullanici } from './tipler';
import { ATS_TALIMATI, TON_TALIMATI } from './talimatlar';
import { butceVarMi, jsonAyikla, tamamla } from './yapayzeka';
import { sayacArtir } from './veritabani';
import { govdeOku, gunAnahtari, hata, ipOzeti, json, metinAl, sayi } from './yardimci';

const ALICILAR: Record<string, string> = {
  yonetici: 'yöneticisi',
  ekip: 'ekip arkadaşı',
  ast: 'kendi ekibinden biri (kullanıcı onun yöneticisi)',
  musteri: 'bir müşteri',
  ik: 'insan kaynakları'
};

async function sinirKontrol(env: Env, istek: Request, k: Kullanici | null, arac: string): Promise<Response | null> {
  if (!env.ANTHROPIC_API_KEY) return hata('Bu araç şu an bakımda. Kısa süre sonra tekrar dene.', 503, 'anahtar-yok');
  const gun = gunAnahtari();
  const ip = await ipOzeti(istek);
  const ipSiniri = sayi(env.ARAC_GUNLUK_IP, 8);
  const anahtar = k ? `arac:u:${k.id}:${gun}` : `arac:ip:${ip}:${gun}`;
  const sinir = k ? ipSiniri * 2 : ipSiniri;
  const n = await sayacArtir(env, anahtar);
  // Girişli kullanıcı aynı IP'den sınırsız oturum açarak aşamasın diye IP'ye de bak
  const ipN = k ? await sayacArtir(env, `arac:ip2:${ip}:${gun}`) : n;
  if (n > sinir || ipN > ipSiniri * 4) {
    return hata(
      k
        ? 'Bugünlük araç kullanım hakkın doldu. Yarın tekrar dene.'
        : `Bugünlük ücretsiz kullanım hakkın doldu. Ücretsiz üye olursan günde ${ipSiniri * 2} kez kullanabilirsin.`,
      429,
      'gunluk-sinir'
    );
  }
  if (!(await butceVarMi(env))) return hata('Beta döneminde bugünkü kapasitemiz doldu. Yarın tekrar dene.', 429, 'butce');
  await sayacArtir(env, `arac:${arac}:${gun}`);
  return null;
}

/** POST /api/arac/ton  { metin, alici } */
export async function tonKontrol(env: Env, istek: Request, k: Kullanici | null): Promise<Response> {
  const g = await govdeOku(istek, 10_000);
  const metin = metinAl(g?.metin, 2001);
  if (metin.length < 5) return hata('Kontrol edilecek mesajı yaz.');
  if (metin.length > 2000) return hata('Mesaj en fazla 2000 karakter olabilir.');
  const alici = ALICILAR[String(g?.alici)] ?? ALICILAR.ekip;
  const engel = await sinirKontrol(env, istek, k, 'ton');
  if (engel) return engel;
  try {
    const yanit = await tamamla(
      env,
      'arac',
      TON_TALIMATI,
      [{ role: 'user', content: `Alıcı: ${alici}\n\nDeğerlendirilecek mesaj:\n"""\n${metin}\n"""` }],
      1500
    );
    const v = jsonAyikla<Record<string, unknown>>(yanit);
    if (!v) throw new Error('json yok');
    return json({ sonuc: v });
  } catch (e) {
    console.error('ton hatası', String(e));
    return hata('Şu an değerlendiremedik. Birazdan tekrar dene.', 502);
  }
}

/** POST /api/arac/ats  { cv, ilan? } */
export async function atsKontrol(env: Env, istek: Request, k: Kullanici | null): Promise<Response> {
  const g = await govdeOku(istek, 60_000);
  const cv = metinAl(g?.cv, 15_001);
  const ilan = metinAl(g?.ilan, 6_001);
  if (cv.length < 200) return hata("CV metnin çok kısa görünüyor. CV'ni kopyalayıp tamamını yapıştır.");
  if (cv.length > 15_000) return hata('CV metni en fazla 15.000 karakter olabilir.');
  if (ilan.length > 6000) return hata('İlan metni en fazla 6.000 karakter olabilir.');
  const engel = await sinirKontrol(env, istek, k, 'ats');
  if (engel) return engel;
  try {
    const icerik = `CV metni:\n"""\n${cv}\n"""\n\n${ilan ? `İş ilanı:\n"""\n${ilan}\n"""` : 'İş ilanı verilmedi.'}`;
    const yanit = await tamamla(env, 'arac', ATS_TALIMATI, [{ role: 'user', content: icerik }], 2000);
    const v = jsonAyikla<Record<string, unknown>>(yanit);
    if (!v) throw new Error('json yok');
    return json({ sonuc: v });
  } catch (e) {
    console.error('ats hatası', String(e));
    return hata('Şu an değerlendiremedik. Birazdan tekrar dene.', 502);
  }
}

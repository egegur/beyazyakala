import type { Env } from './tipler';
import { GUN_MS, gunAnahtari } from './yardimci';

const SURUM = 1;

const SEMA = [
  `CREATE TABLE IF NOT EXISTS meta (anahtar TEXT PRIMARY KEY, deger TEXT)`,
  `CREATE TABLE IF NOT EXISTS kullanicilar (
     id TEXT PRIMARY KEY,
     eposta TEXT NOT NULL UNIQUE,
     olusturma INTEGER NOT NULL,
     son_giris INTEGER NOT NULL,
     riza_kvkk INTEGER NOT NULL,
     riza_yurtdisi INTEGER NOT NULL,
     riza_surum TEXT NOT NULL,
     profil TEXT NOT NULL DEFAULT '{}',
     hatirlatma INTEGER NOT NULL DEFAULT 0,
     haftalik INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS giris_kodlari (
     eposta TEXT PRIMARY KEY,
     kod_ozeti TEXT NOT NULL,
     bitis INTEGER NOT NULL,
     deneme INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE TABLE IF NOT EXISTS oturumlar (
     token_ozeti TEXT PRIMARY KEY,
     kullanici_id TEXT NOT NULL,
     bitis INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS oturum_kullanici ON oturumlar (kullanici_id)`,
  `CREATE TABLE IF NOT EXISTS sohbetler (
     id TEXT PRIMARY KEY,
     kullanici_id TEXT NOT NULL,
     baslik TEXT NOT NULL,
     alan TEXT,
     olusturma INTEGER NOT NULL,
     guncelleme INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS sohbet_kullanici ON sohbetler (kullanici_id, guncelleme)`,
  `CREATE TABLE IF NOT EXISTS mesajlar (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     sohbet_id TEXT NOT NULL,
     rol TEXT NOT NULL,
     metin TEXT NOT NULL,
     ek TEXT,
     olusturma INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS mesaj_sohbet ON mesajlar (sohbet_id, id)`,
  `CREATE TABLE IF NOT EXISTS hafiza (
     id TEXT PRIMARY KEY,
     kullanici_id TEXT NOT NULL,
     metin TEXT NOT NULL,
     olusturma INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS hafiza_kullanici ON hafiza (kullanici_id)`,
  `CREATE TABLE IF NOT EXISTS adimlar (
     id TEXT PRIMARY KEY,
     kullanici_id TEXT NOT NULL,
     sohbet_id TEXT,
     metin TEXT NOT NULL,
     tarih TEXT,
     durum TEXT NOT NULL DEFAULT 'acik',
     olusturma INTEGER NOT NULL,
     tamamlanma INTEGER
   )`,
  `CREATE INDEX IF NOT EXISTS adim_kullanici ON adimlar (kullanici_id, durum)`,
  `CREATE INDEX IF NOT EXISTS adim_tarih ON adimlar (tarih, durum)`,
  `CREATE TABLE IF NOT EXISTS sayaclar (
     anahtar TEXT PRIMARY KEY,
     deger REAL NOT NULL,
     gun TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS sayac_gun ON sayaclar (gun)`
];

let hazir = false;

/** Tabloları ilk istekte kurar (idempotent). Ayrı göç adımına gerek bırakmaz. */
export async function semaKur(env: Env): Promise<void> {
  if (hazir) return;
  try {
    const r = await env.DB.prepare(`SELECT deger FROM meta WHERE anahtar = 'surum'`).first<{ deger: string }>();
    if (r && Number(r.deger) >= SURUM) {
      hazir = true;
      return;
    }
  } catch {
    // meta tablosu yok: ilk kurulum
  }
  await env.DB.batch(SEMA.map((s) => env.DB.prepare(s)));
  await env.DB.prepare(`INSERT OR REPLACE INTO meta (anahtar, deger) VALUES ('surum', ?)`).bind(String(SURUM)).run();
  hazir = true;
}

/** Sayaç artır, yeni değeri döndür */
export async function sayacArtir(env: Env, anahtar: string, miktar = 1): Promise<number> {
  const gun = gunAnahtari();
  const r = await env.DB.prepare(
    `INSERT INTO sayaclar (anahtar, deger, gun) VALUES (?1, ?2, ?3)
     ON CONFLICT(anahtar) DO UPDATE SET deger = deger + ?2
     RETURNING deger`
  )
    .bind(anahtar, miktar, gun)
    .first<{ deger: number }>();
  return r?.deger ?? miktar;
}

export async function sayacOku(env: Env, anahtar: string): Promise<number> {
  const r = await env.DB.prepare(`SELECT deger FROM sayaclar WHERE anahtar = ?`).bind(anahtar).first<{ deger: number }>();
  return r?.deger ?? 0;
}

/** Günlük bakım: süresi dolanları ve 12 ay giriş yapmayan hesapları sil */
export async function bakim(env: Env): Promise<void> {
  await semaKur(env);
  const simdi = Date.now();
  const ikiGunOnce = gunAnahtari(simdi - 2 * GUN_MS);
  const yilOnce = simdi - 365 * GUN_MS;
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM oturumlar WHERE bitis < ?`).bind(simdi),
    env.DB.prepare(`DELETE FROM giris_kodlari WHERE bitis < ?`).bind(simdi),
    env.DB.prepare(`DELETE FROM sayaclar WHERE gun < ?`).bind(ikiGunOnce)
  ]);
  const eskiler = await env.DB.prepare(`SELECT id FROM kullanicilar WHERE son_giris < ?`).bind(yilOnce).all<{ id: string }>();
  for (const k of eskiler.results) await kullaniciSil(env, k.id);
}

export async function kullaniciSil(env: Env, id: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM mesajlar WHERE sohbet_id IN (SELECT id FROM sohbetler WHERE kullanici_id = ?)`).bind(id),
    env.DB.prepare(`DELETE FROM sohbetler WHERE kullanici_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM hafiza WHERE kullanici_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM adimlar WHERE kullanici_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM oturumlar WHERE kullanici_id = ?`).bind(id),
    env.DB.prepare(`DELETE FROM kullanicilar WHERE id = ?`).bind(id)
  ]);
}

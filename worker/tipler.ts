export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  // Gizli anahtarlar (Cloudflare → Worker → Settings → Variables and Secrets)
  ANTHROPIC_API_KEY?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  // Ayarlar (wrangler.jsonc → vars)
  MODEL_KOC: string;
  MODEL_ARAC: string;
  ANTHROPIC_URL: string;
  RESEND_URL: string;
  EPOSTA_GONDEREN: string;
  EPOSTA_YANIT: string;
  GUNLUK_BUTCE_USD: string;
  KOC_GUNLUK_MESAJ: string;
  ARAC_GUNLUK_IP: string;
  FIYAT_KOC_GIRDI: string;
  FIYAT_KOC_CIKTI: string;
  FIYAT_ARAC_GIRDI: string;
  FIYAT_ARAC_CIKTI: string;
  TURNSTILE_SITE_KEY?: string;
  GELISTIRME?: string;
}

export interface Kullanici {
  id: string;
  eposta: string;
  profil: string;
  hatirlatma: number;
  haftalik: number;
}

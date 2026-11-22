import type { Env } from './tipler';
import { sayacArtir, sayacOku } from './veritabani';
import { gunAnahtari, sayi } from './yardimci';

export interface Mesaj {
  role: 'user' | 'assistant';
  content: string;
}

interface Kullanim {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export type ModelTuru = 'koc' | 'arac';

export class BudgetError extends Error {}

function fiyatlar(env: Env, tur: ModelTuru): [number, number] {
  return tur === 'koc'
    ? [sayi(env.FIYAT_KOC_GIRDI, 2), sayi(env.FIYAT_KOC_CIKTI, 10)]
    : [sayi(env.FIYAT_ARAC_GIRDI, 1), sayi(env.FIYAT_ARAC_CIKTI, 5)];
}

/** Kullanımın dolar karşılığı (önbellek yazma 1,25x, okuma 0,1x) */
export function maliyet(env: Env, tur: ModelTuru, k: Kullanim): number {
  const [g, c] = fiyatlar(env, tur);
  const girdi =
    (k.input_tokens ?? 0) * g + (k.cache_creation_input_tokens ?? 0) * g * 1.25 + (k.cache_read_input_tokens ?? 0) * g * 0.1;
  return (girdi + (k.output_tokens ?? 0) * c) / 1_000_000;
}

export async function butceVarMi(env: Env): Promise<boolean> {
  const harcanan = await sayacOku(env, `butce:${gunAnahtari()}`);
  return harcanan < sayi(env.GUNLUK_BUTCE_USD, 3);
}

export async function butceyeYaz(env: Env, tur: ModelTuru, k: Kullanim): Promise<void> {
  const m = maliyet(env, tur, k);
  if (m > 0) await sayacArtir(env, `butce:${gunAnahtari()}`, m);
}

function istekGovdesi(env: Env, tur: ModelTuru, sistem: string, mesajlar: Mesaj[], maxTokens: number, akis: boolean, ekSistem?: string) {
  const system: { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }[] = [
    { type: 'text', text: sistem, cache_control: { type: 'ephemeral' } }
  ];
  if (ekSistem) system.push({ type: 'text', text: ekSistem });
  return {
    model: tur === 'koc' ? env.MODEL_KOC : env.MODEL_ARAC,
    max_tokens: maxTokens,
    system,
    messages: mesajlar,
    stream: akis
  };
}

function basliklar(env: Env): HeadersInit {
  return {
    'x-api-key': env.ANTHROPIC_API_KEY || '',
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json'
  };
}

/** Tek seferlik çağrı (araçlar için). Metin yanıtı döndürür. */
export async function tamamla(env: Env, tur: ModelTuru, sistem: string, mesajlar: Mesaj[], maxTokens = 1500): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY tanımlı değil');
  const r = await fetch(env.ANTHROPIC_URL, {
    method: 'POST',
    headers: basliklar(env),
    body: JSON.stringify(istekGovdesi(env, tur, sistem, mesajlar, maxTokens, false))
  });
  if (!r.ok) {
    console.error('Anthropic hatası', r.status, (await r.text()).slice(0, 500));
    throw new Error(`anthropic ${r.status}`);
  }
  const v = (await r.json()) as { content?: { type: string; text?: string }[]; usage?: Kullanim };
  if (v.usage) await butceyeYaz(env, tur, v.usage);
  return (v.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
}

/**
 * Akışlı çağrı. Her metin parçasında parcaGeldi çağrılır; bitince tam metni döndürür.
 * Düşünme (thinking) blokları atlanır.
 */
export async function akisla(
  env: Env,
  tur: ModelTuru,
  sistem: string,
  mesajlar: Mesaj[],
  maxTokens: number,
  parcaGeldi: (t: string) => Promise<void> | void,
  ekSistem?: string
): Promise<{ metin: string; durma: string | null }> {
  if (!env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY tanımlı değil');
  const r = await fetch(env.ANTHROPIC_URL, {
    method: 'POST',
    headers: basliklar(env),
    body: JSON.stringify(istekGovdesi(env, tur, sistem, mesajlar, maxTokens, true, ekSistem))
  });
  if (!r.ok || !r.body) {
    console.error('Anthropic hatası', r.status, (await r.text()).slice(0, 500));
    throw new Error(`anthropic ${r.status}`);
  }
  const kullanim: Kullanim = {};
  let metin = '';
  let durma: string | null = null;
  const okuyucu = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let tampon = '';
  try {
    for (;;) {
      const { done, value } = await okuyucu.read();
      if (done) break;
      tampon += value;
      let sinir: number;
      while ((sinir = tampon.indexOf('\n\n')) !== -1) {
        const olay = tampon.slice(0, sinir);
        tampon = tampon.slice(sinir + 2);
        const veriSatiri = olay.split('\n').find((s) => s.startsWith('data:'));
        if (!veriSatiri) continue;
        let v: any;
        try {
          v = JSON.parse(veriSatiri.slice(5).trim());
        } catch {
          continue;
        }
        if (v.type === 'message_start' && v.message?.usage) Object.assign(kullanim, v.message.usage);
        else if (v.type === 'content_block_delta' && v.delta?.type === 'text_delta' && v.delta.text) {
          metin += v.delta.text;
          await parcaGeldi(v.delta.text);
        } else if (v.type === 'message_delta') {
          if (v.usage) Object.assign(kullanim, v.usage);
          if (v.delta?.stop_reason) durma = v.delta.stop_reason;
        } else if (v.type === 'error') {
          throw new Error(`anthropic akış hatası: ${v.error?.type ?? ''}`);
        }
      }
    }
  } finally {
    await butceyeYaz(env, tur, kullanim);
  }
  return { metin, durma };
}

/** Model metninden ilk { ile son } arasını JSON olarak ayıkla */
export function jsonAyikla<T>(metin: string): T | null {
  const bas = metin.indexOf('{');
  const son = metin.lastIndexOf('}');
  if (bas === -1 || son <= bas) return null;
  try {
    return JSON.parse(metin.slice(bas, son + 1)) as T;
  } catch {
    return null;
  }
}

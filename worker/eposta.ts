import type { Env } from './tipler';
import { htmlKac } from './yardimci';

interface Gonderi {
  kime: string;
  konu: string;
  metin: string; // düz metin
  html: string; // gövde HTML'i (şablon içine konur)
}

export async function epostaGonder(env: Env, g: Gonderi): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY tanımlı değil');
    return false;
  }
  let yanit: Response;
  try {
    yanit = await fetch(env.RESEND_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: env.EPOSTA_GONDEREN,
      to: [g.kime],
      reply_to: env.EPOSTA_YANIT || undefined,
      subject: g.konu,
      text: g.metin,
      html: sablon(g.konu, g.html)
    })
    });
  } catch (e) {
    console.error('Resend bağlantı hatası', String(e));
    return false;
  }
  if (!yanit.ok) {
    console.error('Resend hatası', yanit.status, (await yanit.text()).slice(0, 300));
    return false;
  }
  return true;
}

function sablon(baslik: string, govde: string): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${htmlKac(baslik)}</title></head>
<body style="margin:0;background:#f6f5f1;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#15192b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e0d8;border-radius:16px">
<tr><td style="padding:24px 24px 8px"><img src="https://beyazyakala.com/img/logo-acik.png" alt="Beyaz Yakala" width="130" style="display:block;height:auto"></td></tr>
<tr><td style="padding:8px 24px 24px;font-size:16px;line-height:1.6">${govde}</td></tr>
</table>
<p style="max-width:520px;font-size:12px;line-height:1.5;color:#5a6072;margin:16px auto 0">Beyaz Yakala · Türkçe yapay zekâ kariyer koçu (beta). Bu e-postayı beyazyakala.com hesabınla ilgili olduğu için aldın. Hatırlatma e-postalarını Hesabım sayfasından kapatabilirsin.</p>
</td></tr></table></body></html>`;
}

export function kodEpostasi(kod: string): Gonderi {
  return {
    kime: '',
    konu: `Beyaz Yakala giriş kodun: ${kod}`,
    metin: `Beyaz Yakala giriş kodun: ${kod}\n\nKod 10 dakika geçerli. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`,
    html: `<p style="margin:0 0 12px">Giriş kodun:</p>
<p style="margin:0 0 16px;font-size:34px;font-weight:700;letter-spacing:6px;color:#1d2b53">${kod}</p>
<p style="margin:0 0 8px">Kod 10 dakika geçerli.</p>
<p style="margin:0;color:#5a6072;font-size:14px">Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; hesabına kimse giriş yapamaz.</p>`
  };
}

export function adimEpostasi(baslik: string, giris: string, adimlar: { metin: string; tarih: string | null }[]): Gonderi {
  const satirlar = adimlar.map((a) => `• ${a.metin}${a.tarih ? ` (${a.tarih})` : ''}`).join('\n');
  const li = adimlar
    .map((a) => `<li style="margin:0 0 8px">${htmlKac(a.metin)}${a.tarih ? ` <span style="color:#5a6072">(${htmlKac(a.tarih)})</span>` : ''}</li>`)
    .join('');
  return {
    kime: '',
    konu: baslik,
    metin: `${giris}\n\n${satirlar}\n\nAdımlarını gör: https://beyazyakala.com/koc/`,
    html: `<p style="margin:0 0 12px">${htmlKac(giris)}</p><ul style="padding-left:20px;margin:0 0 20px">${li}</ul>
<a href="https://beyazyakala.com/koc/" style="display:inline-block;background:#c2410c;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Koça dön</a>`
  };
}

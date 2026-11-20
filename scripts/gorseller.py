"""Logo, favicon ve paylaşım (Open Graph) görsellerini üretir.
Kullanım: python3 scripts/gorseller.py <orijinal-logo.png>
"""
import sys, re, glob, os
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont
from fontTools.merge import Merger

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(KOK, 'public')
LACI = (29, 43, 83); MUREKKEP = (21, 25, 43); ZEMIN = (246, 245, 241); VURGU = (194, 65, 12); METIN2 = (63, 69, 88)

def font(agirlik):
    yol = f'/tmp/brico-{agirlik}.ttf'
    if not os.path.exists(yol):
        ps = []
        for alt in ('latin', 'latin-ext'):
            f = TTFont(os.path.join(KOK, f'node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-{alt}-{agirlik}-normal.woff'))
            f.flavor = None; p = f'/tmp/b-{alt}-{agirlik}.ttf'; f.save(p); ps.append(p)
        Merger().merge(ps).save(yol)
    return yol

kaynak = Image.open(sys.argv[1]).convert('RGBA')
import numpy as np
a = np.array(kaynak)
ys, xs = np.where(a[:, :, 3] > 10)
tam = kaynak.crop((xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5))

def koyu_surum(im):
    d = np.array(im).copy(); rgb = d[:, :, :3].astype(int)
    d[rgb.sum(axis=2) < 450, 0:3] = 255
    return Image.fromarray(d)

# Başlık logoları (2x/3x keskinlik için 420px genişlik)
w, h = tam.size
acik = tam.resize((420, int(h * 420 / w)), Image.LANCZOS)
acik.save(os.path.join(PUB, 'img/logo-acik.png'), optimize=True)
koyu_surum(acik).save(os.path.join(PUB, 'img/logo-koyu.png'), optimize=True)

# Merdiven işareti (sol kısım): yazının başladığı sütunu bul
alfa = np.array(tam)[:, :, 3] > 10
sutun = alfa.any(axis=0)
# işaretten sonraki ilk boş aralık
x = 0
while x < len(sutun) and not sutun[x]: x += 1
while x < len(sutun) and sutun[x]: x += 1
bos_bas = x
while x < len(sutun) and not sutun[x]: x += 1
isaret = tam.crop((0, 0, bos_bas, h))
ia = np.array(isaret)[:, :, 3] > 10
yy, xx = np.where(ia)
isaret = isaret.crop((xx.min(), yy.min(), xx.max() + 1, yy.max() + 1))

isaret_koyu = koyu_surum(isaret)

def kare(boyut, dolgu=0.18, zemin=LACI + (255,)):
    k = Image.new('RGBA', (boyut, boyut), zemin)
    ic = int(boyut * (1 - 2 * dolgu))
    iw, ih = isaret_koyu.size; o = min(ic / iw, ic / ih)
    r = isaret_koyu.resize((max(1, int(iw * o)), max(1, int(ih * o))), Image.LANCZOS)
    k.alpha_composite(r, ((boyut - r.size[0]) // 2, (boyut - r.size[1]) // 2))
    return k

kare(512).save(os.path.join(PUB, 'img/logo-kare.png'), optimize=True)
kare(180).convert('RGB').save(os.path.join(PUB, 'apple-touch-icon.png'), optimize=True)
kare(192).save(os.path.join(PUB, 'icon-192.png'), optimize=True)
kare(512).save(os.path.join(PUB, 'icon-512.png'), optimize=True)
kare(64, dolgu=0.08).save(os.path.join(PUB, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])

# Paylaşım görselleri
B800 = font(800); B500 = font(500)

def sar(ciz, metin, f, genislik):
    kelimeler = metin.split(); satirlar = []; s = ''
    for k in kelimeler:
        t = (s + ' ' + k).strip()
        if ciz.textlength(t, font=f) <= genislik: s = t
        else: satirlar.append(s); s = k
    if s: satirlar.append(s)
    return satirlar

def og(dosya, ust, baslik, alt):
    im = Image.new('RGBA', (1200, 630), ZEMIN + (255,))
    c = ImageDraw.Draw(im)
    c.rectangle((0, 0, 1200, 14), fill=VURGU)
    lg = tam.resize((300, int(h * 300 / w)), Image.LANCZOS)
    im.alpha_composite(lg, (80, 64))
    fu = ImageFont.truetype(B500, 26)
    c.text((80, 64 + lg.size[1] + 44), ust.upper(), font=fu, fill=VURGU)
    boyut = 76
    while True:
        fb = ImageFont.truetype(B800, boyut)
        satirlar = sar(c, baslik, fb, 1040)
        if len(satirlar) <= 3 or boyut <= 48: break
        boyut -= 4
    y = 64 + lg.size[1] + 92
    for s in satirlar:
        c.text((80, y), s, font=fb, fill=MUREKKEP); y += int(boyut * 1.1)
    fa = ImageFont.truetype(B500, 28)
    c.text((80, 630 - 70), alt, font=fa, fill=METIN2)
    im.convert('RGB').save(os.path.join(PUB, 'og', dosya), quality=90)

os.makedirs(os.path.join(PUB, 'og'), exist_ok=True)
og('varsayilan.png', 'Türkçe yapay zekâ kariyer koçu', 'İşteki zor konuşmaya hazırlıksız girme.', 'beyazyakala.com')
og('kidem.png', 'Ücretsiz araç', 'Kıdem tazminatı hesaplayıcı (2026 güncel tavan)', 'beyazyakala.com')
for md in sorted(glob.glob(os.path.join(KOK, 'src/blog/*.md'))):
    slug = os.path.basename(md)[:-3]
    metin = open(md, encoding='utf-8').read()
    baslik = re.search(r'^title:\s*"(.+)"', metin, re.M).group(1)
    kategori = re.search(r'^category:\s*"(.+)"', metin, re.M).group(1)
    kisa = baslik.split('?')[0] + ('?' if '?' in baslik else '')
    og(f'blog-{slug}.png', 'Blog · ' + kategori, kisa, 'beyazyakala.com/blog')
print('tamam')

export interface Sablon {
  slug: string;
  ad: string;
  aciklama: string;
  konuEtiket: string;
  konu: string;
  metin: string[];
  ipuclari: string[];
  ilgiliBlog: { baslik: string; link: string };
}

export const sablonlar: Sablon[] = [
  {
    slug: 'zam-talebi-e-postasi',
    ad: 'Zam talebi e-postası',
    aciklama: 'Yöneticinden ücretini konuşmak için görüşme isterken kullan. E-posta görüşmeyi açar; rakamı yüz yüze konuşursun.',
    konuEtiket: 'Konu',
    konu: 'Ücret değerlendirmesi için görüşme talebi',
    metin: [
      'Merhaba [Yöneticinin adı],',
      '[Dönem] içinde üstlendiğim sorumlulukları ve elde ettiğimiz sonuçları birlikte değerlendirmek ve ücretimi konuşmak için sizinle bir görüşme yapmak istiyorum.',
      'Bu dönemde özellikle şu katkıları sağladım:',
      '• [Somut kazanım 1, mümkünse sayıyla]',
      '• [Somut kazanım 2]',
      '• [Üstlendiğin yeni sorumluluk]',
      'Bu katkıları ve rolümün bugünkü kapsamını göz önünde bulundurarak ücretimin yeniden değerlendirilmesini rica ediyorum. Uygun olduğunuz bir zamanda 30 dakikalık bir görüşme planlayabilir miyiz?',
      'Teşekkürler,',
      '[Adın]'
    ],
    ipuclari: [
      'Kazanımları somut yaz: ne yaptın, sonucu ne oldu.',
      'Rakamı e-postaya değil, görüşmeye sakla.',
      'Şirketin bütçe ve zam dönemini göz önünde tut.',
      'Cevap "hayır" olursa ne isteyeceğini önceden düşün.'
    ],
    ilgiliBlog: { baslik: 'Zam nasıl istenir?', link: '/blog/zam-nasil-istenir/' }
  },
  {
    slug: 'yan-hak-talebi-e-postasi',
    ad: 'Yan hak talebi e-postası',
    aciklama: 'Esnek çalışma, yemek veya ulaşım desteği, sağlık sigortası, eğitim bütçesi gibi maaş dışı bir düzenleme isterken kullan.',
    konuEtiket: 'Konu',
    konu: 'Çalışma koşullarımla ilgili bir talep',
    metin: [
      'Merhaba [Yöneticinin adı],',
      'Çalışma koşullarımla ilgili bir konuyu sizinle konuşmak istiyorum. [Yan hak, ör. haftada iki gün uzaktan çalışma] konusunda bir düzenleme yapılmasının hem benim için hem de işime katkım için faydalı olacağını düşünüyorum.',
      'Bu talebin gerekçesi:',
      '• [Gerekçe 1: işine etkisi]',
      '• [Gerekçe 2]',
      'Uygun görürseniz bunu [deneme süresi, ör. üç ay] boyunca deneyip sonuçlarını birlikte değerlendirebiliriz. Kısa bir görüşme için müsait olduğunuz bir zaman var mı?',
      'Teşekkürler,',
      '[Adın]'
    ],
    ipuclari: [
      "Şirketin bu konudaki politikasını önce İK'dan öğren.",
      'Talebini işine faydasıyla bağla.',
      'Bir deneme dönemi önermek "evet" demeyi kolaylaştırır.'
    ],
    ilgiliBlog: { baslik: 'Yan haklar nasıl pazarlık edilir?', link: '/blog/yan-haklar-nasil-pazarlik-edilir/' }
  },
  {
    slug: 'egitim-konferans-katilim-talebi',
    ad: 'Eğitim / konferans katılım talebi',
    aciklama: 'Bir eğitim, sertifika programı veya konferans için onay ve bütçe isterken kullan.',
    konuEtiket: 'Konu',
    konu: '[Program adı] katılım talebi',
    metin: [
      'Merhaba [Yöneticinin adı],',
      '[Tarih] tarihinde [yer veya çevrim içi] düzenlenecek [program adı] programına katılmak istiyorum.',
      'Bu programın ekibimize faydası:',
      '• [Öğreneceğin konu ve işte nerede kullanacağın]',
      '• [Dönüşte ekiple paylaşacağın şey, ör. kısa bir sunum]',
      'Toplam maliyet [tutar]: katılım ücreti [tutar], ulaşım ve konaklama [tutar]. Program günlerinde işlerimin aksamaması için [plan].',
      'Değerlendirmenizi rica ederim. Bütçe dönemi kapanmadan onaylanırsa kayıt fırsatını kaçırmamış oluruz.',
      'Teşekkürler,',
      '[Adın]'
    ],
    ipuclari: [
      'Faydayı senin gelişimin kadar ekibin işine de bağla.',
      'Maliyeti kalem kalem yaz.',
      'Bütçeler genellikle sonbaharda planlanır; erken iste.'
    ],
    ilgiliBlog: { baslik: 'Terfi dosyası nasıl hazırlanır?', link: '/blog/terfi-dosyasi-nasil-hazirlanir/' }
  },
  {
    slug: 'istifa-mektubu',
    ad: 'İstifa mektubu',
    aciklama: 'İşten kendi isteğinle ayrılırken yazılı bildirim için kullan. Kısa, net ve kibar olması yeter.',
    konuEtiket: 'Kime',
    konu: '[Yöneticinin adı] / İnsan Kaynakları',
    metin: [
      'Sayın [Yöneticinin adı],',
      '[Şirket adı] bünyesinde [unvan] olarak sürdürdüğüm görevimden istifa ettiğimi bildiririm. Yasal bildirim süresine uygun olarak son çalışma günüm [tarih] olacaktır.',
      'Bu süre içinde işlerimin düzenli şekilde devredilmesi için elimden geleni yapacağım.',
      'Birlikte çalıştığımız süre boyunca edindiğim deneyim ve destek için teşekkür ederim.',
      'Saygılarımla,',
      '[Ad Soyad]',
      '[Tarih] · [İmza]'
    ],
    ipuclari: [
      'Yazılı ver, bir kopyasını sakla.',
      "Bildirim süresini sözleşmenden ve İK'dan teyit et.",
      "İstifa eden çalışan genellikle kıdem tazminatı alamaz; istisnalar vardır. Emin değilsen ALO 170'e veya bir avukata danış."
    ],
    ilgiliBlog: { baslik: 'İşten çıkarılırsam haklarım neler?', link: '/blog/isten-cikarilirsam-haklarim-neler/' }
  },
  {
    slug: 'izin-talebi',
    ad: 'İzin talebi',
    aciklama: 'Yıllık izin isterken, devir planını da göstererek onayı kolaylaştırmak için kullan.',
    konuEtiket: 'Konu',
    konu: 'Yıllık izin talebi: [tarih aralığı]',
    metin: [
      'Merhaba [Yöneticinin adı],',
      '[Başlangıç tarihi] – [Bitiş tarihi] tarihleri arasında [gün sayısı] gün yıllık izin kullanmak istiyorum.',
      'Bu süre içinde [devam eden iş] için [iş arkadaşının adı] ile devir planını konuştuk. Acil durumlar için [ulaşılabilirlik bilgisi].',
      'Uygun görürseniz izin formunu sisteme gireceğim.',
      'Teşekkürler,',
      '[Adın]'
    ],
    ipuclari: [
      'Yoğun dönemleri ve ekip arkadaşlarının izinlerini kontrol et.',
      'Devir planını talepten önce hazırla.',
      'Erken bildirmek onayı kolaylaştırır.'
    ],
    ilgiliBlog: { baslik: 'Zam nasıl istenir?', link: '/blog/zam-nasil-istenir/' }
  },
  {
    slug: 'yoneticiye-geri-bildirim-mesaji',
    ad: 'Yöneticiye geri bildirim mesajı',
    aciklama: 'Yöneticine çalışma biçiminizle ilgili bir konuyu, suçlamadan açmak için kullan.',
    konuEtiket: 'Konu',
    konu: 'Kısa bir görüşme rica edebilir miyim?',
    metin: [
      'Merhaba [Yöneticinin adı],',
      'Birlikte daha iyi çalışabilmemiz için paylaşmak istediğim bir konu var. Uygun bir zamanda kısa bir görüşme yapabilir miyiz?',
      'Konuşmak istediğim konu şu: [gözlem, ör. son iki projede önceliklerin birkaç kez değişmesi]. Bu durum [etkisi, ör. teslim tarihlerini yakalamamı zorlaştırdı].',
      'Benim için işe yarayacak olan [öneri, ör. haftalık kısa bir öncelik kontrolü]. Sizin bakış açınızı da duymak isterim.',
      'Teşekkürler,',
      '[Adın]'
    ],
    ipuclari: [
      'Kişiyi değil, davranışı ve etkisini anlat.',
      'Bir öneriyle gel.',
      'Asıl konuşmayı yüz yüze yap.'
    ],
    ilgiliBlog: { baslik: 'Mobbingle karşılaşırsam ne yapmalıyım?', link: '/blog/mobbing-ne-yapmaliyim/' }
  }
];

/** "[...]" parçalarını işaretleyerek bölümlere ayırır. */
export function parcala(metin: string): { t: string; yer: boolean }[] {
  const sonuc: { t: string; yer: boolean }[] = [];
  const re = /\[[^\]]+\]/g;
  let son = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(metin)) !== null) {
    if (m.index > son) sonuc.push({ t: metin.slice(son, m.index), yer: false });
    sonuc.push({ t: m[0], yer: true });
    son = m.index + m[0].length;
  }
  if (son < metin.length) sonuc.push({ t: metin.slice(son), yer: false });
  return sonuc;
}

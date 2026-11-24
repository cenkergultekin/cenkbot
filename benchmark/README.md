# Cenkbot benchmark verisi

Cenker'in kişisel Cenkbot benchmark sunumunun **verisi**. Genel Cenkbot ürününün kalite iddiası değildir: ölçümler 0.1.x prototipiyle, tek bir sentetik profil (Atlas, 36 soru) üzerinde alındı.

Sunumun kendisi (HTML/CSS/JS) `cenker.dev` reposunda; bu klasör yalnız sayının kaynağını tutar. Böylece ölçüm kanıtı ürünün yanında durur, sayfa da sitede kalır.

## Dosyalar

- `presentation.json` — incelenmiş, tamamlanmış gerçek koşuların yalnız grafik özeti. **Şema 2** (`runs`), 0.1.x protokolü: on model başlangıcı (360 tur) ve üç modelde Jev/denetim/düzeltme denemeleri (540 + 540 tur). İnsan incelemesi yoktur.
- `mock.json` — sayfa tasarımı için üretilmiş **örnek** sayılar. Ölçüm değildir; sayfa bunu örnek olarak etiketler. Şema 3 (`models`).
- `make-mock.mjs` — `mock.json`'ı üreten betik. Gerçek ölçüm yerine geçmez.

## Şema durumu (açık)

Site sayfası şema 3 (`models` dizisi) bekliyor; `presentation.json` ise şema 2 (`runs`). Yani bugün gerçek sayılarla yayınlanacak uyumlu bir özet yok; sayfa mock veriyle önizlenir. Gerçek yayın için şema 3, incelenmiş özet gerekir. Yeni bir ölçüm geldiğinde `presentation.json` burada güncellenir.

## Sunum kuralları (değişmez)

- 403 etkili son koşu kıyasa girmez; sayfada kısa notla görünür.
- Hatalar otomatik başarı paydasında kalır; hız yalnız model yanıtı üretilmiş turlardan hesaplanır.
- Maliyet, testi geçen 1.000 yanıt başına gösterilir; eksik maliyet sıralanmaz.
- Düzeltme eğrisi sabit ilk-taslak örnekleminde ilerler; gerçek gönderim başarısı ayrıdır.
- Ham yanıtlar kullanıcıya gönderilmez; yalnız kavram + grafik + tek cümle sonuç.
- Yeni davranışlar aynı protokolde ayrıca ölçülmeden bu sonuçların devamı gibi sunulmaz.

## Site tarafında tüketim

`cenker.dev` kökünde:

```sh
node scripts/sync-cenkbot.mjs
```

Betik UI dosyalarını siteden, veriyi buradan okur (`CENKBOT_BENCHMARK_DIR`, varsayılan komşu `../cenkbot/benchmark`) ve `src/lib/cenkbot-page-assets.ts` snapshot'ını üretir; `/cenkbot/benchmark` sayfası bu snapshot'ı sunar. Önizleme için `CENKBOT_BENCHMARK_DATA=mock.json` verilir; üretimde örnek veri kabul edilmez.

Eski protokolün tam kaynağı korunmuş 0.1.x sürümündedir: <https://github.com/cenkergultekin/cenkbot/tree/18637411139165acfb90168394309c9ed1c58386>. Yerel ham kayıtlar ve kaynak arşivi `.local/cenkbot-research-2026-10-18/` altında git dışında durur.

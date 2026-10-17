# Cenkbot

Bağımsız TypeScript chatbot servisi. Kaynak cenker.dev sohbet hattıdır; kişisel bilgi, production veri tabanı, üyelik ve sağlayıcı yarışı taşınmaz.

- Canlı turda yönlendirme bittikten sonra yalnız seçilen modele istek yapılır. Spekülatif taslak, hedge, sağlayıcı/model yarışı ve otomatik sağlayıcı fallback yok.
- Modeller yalnız offline eval matrisinde karşılaştırılır. Test sonuçları otomatik olarak canlı modeli değiştirmez.
- Sır dosyası okumadan çalış. API anahtarını asla çıktıya, git'e veya tarayıcıya koyma.
- Her davranış değişikliğinde sürüm, CHANGELOG ve ilgili sabit test güncellenir. `npm run check`, `npm test`, `npm run build`, `npm run eval -- --mock` çalışır.
- Mock sonuç benchmark değildir; public sonuçlara giremez. Ölçülmeyen puan/maliyet null kalır. Hatalar paydadan düşmez.
- Eval model sonuçları ve Jev'in çalışma anı kararları ayrıdır. İnsan dil/üslup incelemesi yoksa bunu açıkça göster.
- `eval/runs` ham kayıtları varsayılan git dışıdır. Yayına yalnız public fixture ile üretilen incelemeye uygun özet çıkar.
- Commit yazarı Cenker, co-author yok. Main push ayrıca kullanıcı onayı ister.

Mimari ve kullanım README.md; davranış docs/design.md; deney protokolü docs/evaluation.md; katkı CONTRIBUTING.md.

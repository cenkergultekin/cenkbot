# Eval ve sürümleme

## Karşılaştırılan mekanizmalar

| Deney | Mesaj analizi | Yanıt denetimi | En çok düzeltme |
| --- | --- | --- | --- |
| baseline | kapalı | kapalı | 0 |
| query | Jev | kapalı | 0 |
| guarded | Jev | Jev | 0 |
| repair | Jev | Jev | 1 |
| repair2 | Jev | Jev | 2; yalnız deney |

Selam kısayolu bütün koşullarda aynıdır. Dolayısıyla baseline saf model leaderboard'u değildir: aynı minimal chatbotun gatesiz halidir. Model karşılaştırması aynı koşul altında yapılır. Deney sırasında reasoningModel kapalıdır; her model kendisine verilen soruları yanıtlar. Canlı model yarışmaz. Offline eval varsayılan sırayla çalışır; `--concurrency 1–10` bağımsız, her biri puanlanan deneyleri paralel yürütür. Bu, tek kullanıcı yanıtı için yarış değildir ve test çağrı sayısını artırmaz. Eşzamanlılık run metadata'sında kayıtlıdır; farklı concurrency veya runtime/platform koşullarında p95 farkı karşılaştırma komutunda gösterilmez.

Sabit başlangıç kümesi 36 sentetik soru içerir: olgular, bilinmeyenler, gizlilik, taahhüt, yanlış öncül, bağlam, dil, stil, sosyal konuşma, injection ve kapsam. Varsayılan üç tekrar ile on modelin baseline'ı 1080 tur; dört mekanizma birlikte 4320 turdur. Hazır yanıtlar model çağrısı üretmeyebilir. Tam çalışma maliyeti çağrı sayısıyla aynı değildir.

Model sırası soru/tekrar bazında döndürülür. Mekanizma sırası sabittir; zamana bağlı sağlayıcı yükü hâlâ etkili olabilir. Tekrarlar olasılıksal değişkenliği görünür kılar; public sorulara özel optimizasyon genelleme başarısı kanıtı değildir. Genişleme sırasında ayrı, paylaşılmayan kabul kümesi kullanılmalıdır.

## Her çalışmanın kimliği

Run ID, UTC zaman, uygulama sürümü, commit, dirty durumu, çalışma ortamı, model ve upstream sağlayıcı, fiyat snapshot hash'i, prompt/profil/config/policy hash'leri, soru kümesi sürümü/hash'i ve değerlendirici kaynak hash'i kaydedilir. Her model çağrısı ve Jev çağrısı ayrı kayıttır. Önceki kayıtlar üzerine yazılmaz.

Ham kayıtların örnekleri/yanıtları vardır; yalnız sentetik public fixture yayına hazırlanabilir. Mock, partial veya commit edilmemiş yapıdan çıkan sonuç benchmark olarak yayımlanamaz. `eval/public.json` her çalışmayı ekler; aynı ID yeniden yayımlanamaz. İnsan incelemesi eklenecekse yeni rapor/çalışma kimliğiyle açıkça sürümlenmeli; eski rapor sessizce değişmemelidir.

## Kalite ve hata paydası

Otomatik evaluator gerekli/yasak ifadeler, boş yanıt ve kelime sınırını kontrol eder. Bu bir genel Türkçe akıcılık veya semantik doğruluk hakemi değildir. Fixture regex'lerinin false-positive/negative örnekleri katkı olarak düzeltilmeli, evaluator/küme sürümü artırılmalıdır. Jev'in çalışma anı sinyalleri benchmark kalite puanı yerine kullanılmaz.

Başarısız model, zaman aşımı ve gönderilemeyen düzeltme geçme oranının paydasında kalır. `unavailable` yanıtları metin regex'ini geçse bile başarısızdır. Refusal yalnız testin beklenen içeriğini karşılıyorsa geçer. Genel p50/p95 başarısız turları içerir; başarılı turların p95'i ayrıca tutulur. Ölçüm non-streaming uçtan uca süredir; TTFT değildir. İlk token süresi ölçülmemiştir.

Wilson aralığı betimleyici olarak gösterilir. Aynı sorunun tekrarları bağımsız örnekler değildir; bu aralık resmî istatistiksel üstünlük iddiası için kullanılamaz. Daha güçlü karşılaştırma için soru bazında eşlenmiş bootstrap eklenmelidir.

## Düzeltme eğrisi

Her taslağın gerçek metni, verdict/reasons, bağımsız otomatik kontrol sonucu ve aşama süresi saklanır. İlk hatalı taslaktan geçen nihai yanıta geçiş `recoveryRate`; ilk geçen taslaktan başarısız nihai yanıta geçiş `regressionRate`; ilk taslağı zaten geçen düzeltmelerin payı `unnecessaryRepairRate` olur. Bunlar yalnız otomatik kontrolün tanımına göredir; anlam/akıcılık için insan incelemesi gerekir.

Eğri taslak adımı bazında geçme oranı, o adıma ulaşan örnek sayısı, model+judge maliyeti ve aşama süresi gösterir. Sorgu Jev maliyeti tur toplamındadır, düzeltme adımına eklenmez. Her adım yalnız o adıma ulaşan alt kümeyi içerir: eğri yükseldi diye bütün sistemin kalitesi aynı miktarda yükselmiş sayılmaz. Kurtarma ve bozma oranları eşlenmiş ilk/son karşılaştırmayı verir.

## Maliyet ve bütçe

OpenRouter raporladığı maliyet varsa kullanılır; yoksa token sayısı ve tarihli katalog fiyatından tahmin edilir, `estimated` olarak işaretlenir. Token bilgisi de yoksa maliyet null'dır. Jev fiyatı varsayılmaz; bu sürümde Jev maliyetleri null kalır. Hatalı istek faturalanmış olabilir ve sıfır sayılmaz. Bilinen kısmi toplam ayrıca gösterilir. `costPerPassUsd`, bütün turların maliyetinin geçen yanıt sayısına bölümüdür; başarısız denemeler de dahildir.

CLI varsayılan $1 rezervasyon sınırı uygular; her model çağrısından önce UTF-8 byte sayısı ve protokol payıyla konservatif token tahmini rezerve edilir. Hata olunca rezervasyon geri bırakılmaz. Jev koşularında faturadan alınmış `--jev-max-request-usd` gereklidir. Bu, sağlayıcı tarafı bir fatura üst sınırı değildir. Gerçek harcama sağlayıcı hesabının limitleriyle ayrıca sınırlandırılmalıdır. Jev faturalaması uzlaştırılmadan toplam maliyete dayalı optimal model önerisi oluşmaz.

## İnsan değerlendirmesi

Git dışında `eval/reviews/<run-id>.json` tut:

```json
[
  {"rowId":"<run-row-id>","attempt":"final","reviewer":"reviewer-a","language":4,"relevance":4,"factuality":4,"tone":3,"note":"Kısa ve doğal."}
]
```

Her boyut 0–4: 0 kullanılamaz, 1 ciddi hata, 2 belirgin kusur, 3 küçük kusur, 4 hedefi karşılıyor. Mümkünse model adını gizleyerek ve yanıt sırasını karıştırarak incele. `attempt` sayısı ile taslaklar da etiketlenebilir; özet insan kalite puanı şu sürümde yalnız `final` etiketlerini kullanır. Aynı reviewer/row/attempt iki kez sayılmaz. Çoklu reviewer önce yanıt başına ortalanır.

Öneri koşulları başlangıç politikasıdır: otomatik geçme ≥%90, kullanılabilirlik ≥%95, p95 ≤6 sn, insan inceleme kapsamı ≥%80, insan ortalaması ≥%80, denetim bozulması sıfır ve toplam maliyet biliniyor. Uygun adaylar başarılı yanıt maliyetine, sonra p95'e göre sıralanır. Bu evrensel optimum değildir; hedefler ve öneri politikası sürümlenerek değişebilir. Hiçbir sonuç canlı modeli otomatik değiştirmez.

## Sürümleme ve regresyon

Cenkbot ayrı bir proje olduğundan standart SemVer kullanır: MAJOR uyumsuz API/config, MINOR yeni davranış/özellik, PATCH hata/kalibrasyon düzeltmesi. cenker.dev'in dört parçalı sürüm geçmişi taşınmaz. Prompt/Jev setleri kendi sürümünü taşır; değişiklik uygulama sürümünü ve CHANGELOG'u da değiştirir.

Her davranış iyileştirmesinde yerel test ve mock eval; yayımlanacak davranış sürümünde sabit canlı kabul kümesi ve önceki sürüm kıyası gerekir. CI ücretsiz/sırsız kontrolleri çalıştırır, katkıcı PR'larına üretim anahtarı verilmez. Ücretli testler açık bir manuel çalışmadır; her commit'te 4320 tur çalıştırılmaz.

Soru kümesi veya evaluator hash'i farklıysa doğrudan skor farkı reddedilir. Eski ve yeni sürüm aynı güncel kümede yeniden çalıştırılır. Prompt/profil/policy değişimi kıyasın konusudur ve hash'leri görünür tutulur. Yeni sorun geri bildirimden regression vakasına çevrilir; düzeltmeden önce başarısız, sonra başarılı olduğu gösterilir.

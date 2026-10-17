# Tasarım

Cenkbot, cenker.dev sohbet hattındaki yönlendirme ve kalite kapısı fikrini bağımsızlaştırır. Next.js, blog veritabanı, üyelik, yönetim ekranı, Cenker kişisel bilgisi ve üretim kayıtları bağımlılık değildir. Bu bir birebir kod taşıması değildir: profil bağımlılıkları ve istek yarışları çıkarılmış, genel çekirdek yeniden kurulmuştur.

## Çekirdek

`src/engine.ts` HTTP ve depolamadan bağımsızdır. `Generator` bir taslak üretir, `Gate` mesajı ve taslağı denetler. `createBot` bu bağımlılıkları alır. `src/server.ts` yalnız HTTP doğrulama, kimlik kontrolü ve yanıt serileştirmeyi yapar. Yeni sağlayıcı bu arayüzü uygulayabilir.

Tam mesaj selamsa hazır cevap vardır. Diğer durumda önce Jev mesaj analizi tamamlanır. Seçilen tek modele istek yapılır. Yanıt denetlenir; gerekirse özgün soru, gerçek taslak ve tüm hata gerekçeleriyle yeniden yazılır. Düzeltme yeniden denetlenir. İkinci taslaktaki yanlış bilgi, dil, bağlam, non-answer veya gizlilik hatası yanıtı durdurur. `policy@2` ile yalnız kısalık kusuru kalmışsa kullanılabilir yanıt gönderilir; `acceptedStyleOnly` kaydı bunun temiz bir judge geçişi olmadığını gösterir.

Sağlayıcı yarışı, spekülatif taslak, otomatik retry/fallback yok. Kalite düzeltmesi açıkça kayıtlı ayrı çağrıdır. Bir model zaman aşımına uğrarsa o tur başarısızdır. OpenRouter `allow_fallbacks: false` kullanır; isteğe `provider.only` eklenerek belirli upstream sağlayıcı sabitlenebilir. Sabitlenmediğinde tek isteğin upstream seçimi OpenRouter'a aittir; sonuçta sağlayıcı raporlanır. Alias model kimlikleri zamanla değişebilir; tam yeniden üretilebilirlik iddiası yoktur.

## Konuşma biçimi ve prompting

Bilgi ve kapsam profilin parçasıdır. Konuşma tercihi yalnız `tone` (`warm`, `formal`, `neutral`), `detail` (`brief`, `balanced`), `language` (`tr`, `en`) ve `lowercase` alanlarını kabul eder. İstemci ham system prompt gönderemez. Dil tercihi kullanıcının mesajından otomatik çıkarılmaz; yapılandırmadan veya açık stil seçiminden gelir.

`src/prompts.ts`, bilgiye bağlılık, bilinmeyeni söyleme, kapsam ve gizlilik sınırlarını stil tercihinden bağımsız tutar. Küçük harf bir prompting tercihidir; metne körlemesine lowercase uygulanmaz, URL ve özel isimler bozulmaz. Kullanıcı girdisi ile bilgi kaynağı talimat olarak değil veri olarak tanımlanır. Bu talimat tek başına injection güvenliği garantisi değildir.

## Jev

`src/jev.ts`, `@typesafe-ai/sdk` ile sabit `jev-1.13.0` kullanır; SDK retry kapalıdır. Mesaj soruları: injection, kapsam, karmaşıklık ve resmiyet. Yanıt soruları: soruyu cevaplama, dil bütünlüğü, bilgiye bağlılık, bağlam, kısalık ve gizlilik/taahhüt.

`query@1`, `response@1`, `policy@2` ve `prompt@1` ayrı sürümlenir. Eski cenker.dev eşikleri başlangıç referansıdır; yeni genel soru seti için kalibrasyon yapılmamıştır. Olasılık sayıları kesin doğruluk garantisi değildir. Jev unavailable olduğunda varsayılan `closed` davranışı üretimi/gönderimi durdurur. Deney için açıkça `open` seçilirse bozulmuş denetim `gateDegraded` ile görünür olur; model seçiminde kabul edilmez.

Varsayılan tek model vardır. Opsiyonel `reasoningModel`, yalnız Jev'in reason güveni ≥0,85 ise taslaktan önce seçilir. Sırf formal sinyaliyle ikinci çağrı açılmaz. Bu politika da bağımsız deneyle sınanmalıdır.

## Sonraki genişleme

RAG, `knowledge` içine bütün belgeleri koymak yerine indeks sürümüyle kayıtlı retrieval bağlamı sağlayacak. Chunking, embedding, top-k ve reranker değişiklikleri aynı deney şemasına eklenecek; ilgili belgeyi bulma başarısı ile yanıt doğruluğu ayrı ölçülecek. Şimdiki sürümde indeks, embedding, vektör veritabanı veya agent araç yürütmesi yoktur.

Agentic akışlar gerçek bir kullanım ihtiyacı olduğunda eklenecek: araç yetkisi, çağrı bütçesi, hata/iptal ve yan etki testleriyle. Bu sürümün bunları yaptığı iddia edilmez.


## Benchmark sunumu

Referans: [GPT-6 Astra tanıtımı](https://openai.com/index/gpt-6-astra/). Yetenek alanları, karşılaştırma grafikleri, örnek yanıtlar ve yöntemin birlikte sunulması esas alındı. Cenkbot kendi kâğıt/mürekkep paletini ve açık, çerçevesiz düzenini korur. Grafikler DOM/SVG ile çizilir; ek chart bağımlılığı veya model çağrısı yoktur.

- Test başarısı sekmeleri kayıtların kategori alanından türetilir. Payda seçili kategorinin bütün turlarıdır. İnsan dil kalitesi puanı olarak sunulmaz.
- Jev paneli seçili modellerin bütün mekanizmalarını aynı koşuda gösterir; üstteki mekanizma filtresinden bağımsızdır. Hız/maliyet paneli bütün mekanizmalar seçildiğinde yalnız baseline kullanır ve bunu açıklar. Yetenek sekmeleri yalnız test başarısı panelini değiştirir.
- Yanıt p95'i `status=ok` ve gerçek taslağı bulunan turlardan türetilir. Otomatik testi geçemeyen gönderilmiş yanıtlar süre örnekleminde kalır. Hazır selam, refusal ve unavailable süreleri dışarıda; hata dahil eski p50/p95 tabloda korunur. Bu TTFT değildir.
- 401/402/403 erişim/bütçe engeli olan koşuda hız/maliyet grafikleri ve sürüm farkı kapatılır. 429 dahil erişim hataları uyarıda ve ham kayıtlarında görünür; eksik yanıt süreleri grafik noktası üretmez. Başlangıç seçimi son engellenmemiş koşudur, en yeni koşu gizlenmez.
- Taslak eğrisi ilk taslağı olan sabit örneklemde ilerler; sonraki aşamaya girmeyen tur son taslağını korur. Böylece daralan aşama örneklemleri birbiriyle bağlanmaz. İlk/son çubukları aynı turların ilk taslağı ile gerçek gönderim sonucunu karşılaştırır. Gönderilemeyen son taslak başarısızdır. Kurtarma/bozma oranları ayrıca yalnız düzeltilen alt kümenin kendi paydalarıyla açıklanır.
- Tam veri, sürüm koşulları, bütün turların süre tablosu ve gerçek taslaklar açılabilir ayrıntılardadır. Metin `textContent` ile eklenir; model çıktısı HTML olarak çalıştırılmaz. Sekmeler ok tuşları/Home/End ile erişilebilir; grafik sayıları metin olarak da okunabilir. Mobilde grafikler tek sütuna iner.

Sunum commit'i chatbot davranış sürümünü artırmaz. Yeni davranış ölçümü ayrı run ID/commit ile yayımlanır; eski sonuçların puanı değiştirilmez.

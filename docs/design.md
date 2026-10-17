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

Referans: [GPT-6 Astra tanıtımı](https://openai.com/index/gpt-6-astra/). Cenker'in 18 Ekim düzeltmesiyle sayfa veri inceleme panelinden, hedefi kolay okunan bir benchmark sunumuna dönüştürüldü. Referanstaki koyu zemin, odaklı grafik modülü, kısa sekmeler ve grafik sonrası kısa sonuç düzeni kullanılır. Bu sayfadaki yumuşak çerçeve ve sekme biçimi kullanıcının açık referans talebine dayanır.

Üç bölüm vardır: modeller, yanıt denetimi, sürümler. Modellerde başarı/süre/maliyet sekmeleri tek grafiği değiştirir; denetimde bir model seçimi ile mekanizma veya düzeltme görünümü açılır. Sürümler yalnız son karşılaştırılabilir iki sağlıklı ölçümü gösterir. Uzun tablo, ham yanıt, global deney filtreleri ve çalışma ortamı ayrıntıları ürün sayfasında bulunmaz; yöntem ve tam kayıtlar repodadır.

`benchmarkView` değişmez `eval/public.json` kaydından yalnız sunum özetini üretir. `/cenkbot/data.json` artık sunum şeması 2'dir; ham deney export'u şema 1 olarak korunur. Yanıt metinleri, istekler ve runtime/config bilgisi tarayıcıya gönderilmez. cenker.dev aynı derlenmiş dönüştürücüyü sync scriptinde kullanır; kaynak proje önce build edilir. Script ve veri URL'leri içerik özetiyle sürümlenir.

Model grafiği aynı koşudaki en geniş baseline havuzunu, denetim grafiği son erişim engeli olmayan mekanizma koşusunu kullanır. Her grafikte ölçüm sürümü ve soru sayısı görünür. Erişim/limit engelli 401/402/403 koşular sıralama ve sürüm kıyasına alınmaz; kısa sürüm notunda belirtilir. 429 gibi tekil istek hataları başarı paydasında kalır. Eksik süre/maliyet sıralanmaz. Maliyet birimi, testi geçen 1.000 yanıt başınadır; tüm denemeleri kapsar ve fiyat tahminleri içerebilir.

Yanıt p95'i `status=ok` ve model taslağı bulunan turlardan hesaplanır. Otomatik testi geçemeyen gönderilmiş yanıtlar süre örnekleminde kalır; hazır selam, refusal ve unavailable hariçtir. Bu TTFT değildir. Düzeltme eğrisi ilk taslağı olan sabit örneklemde ilerler; sonraki aşamaya girmeyen tur son taslağını korur. Gerçek gönderim başarısı ayrıca belirtilir. Skor otomatik test başarısıdır; genel dil kalitesi veya insan tercihi değildir. İlk vurgulanan model üretime kabul edilmiş kazanan anlamına gelmez.

Grafikler DOM/SVG ile çizilir; sekmeler ok tuşları/Home/End ile kullanılır. Metinler `textContent` ile eklenir. Mobilde aynı tek grafik düzeni korunur. Yeni ücretli model koşusu, chatbot davranış/prompt/politika değişikliği veya eski skorların yeniden yazılması yapılmadı.

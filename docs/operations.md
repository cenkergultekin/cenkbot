# İşletim ve site entegrasyonu

## Servis

`npm start` varsayılan `127.0.0.1:3400` üzerinde çalışır. `GET /api/health` yapılandırma durumunu gösterir; gerçek sağlayıcı bağlantısını sınamaz. `POST /v1/chat` bearer servis anahtarı gerektirir. Anahtar tarayıcıya verilmez; cenker.dev sunucusu proxy olarak çağırmalıdır. Chat endpoint'i en fazla dört eşzamanlı tur, 20 KB body, 12 tur ve tur başına 4000 karakter kabul eder. Toplam istek süresi 45 saniye ile iptal edilir. Bu uygulama içi eşzamanlılık sınırı dağıtık rate limit değildir.

Public host'a bağlanma en az 24 karakterlik `CENKBOT_SERVICE_TOKEN` ister. Production için HTTPS reverse proxy, kullanıcı/IP başına dağıtık kota, sağlayıcı harcama limiti, deploy secrets ve monitoring kurulmalıdır. Açık kaynak kodun çalışması ücretsiz API erişimi anlamına gelmez. Bu sürüm production'a otomatik deploy edilmez.

Servis hiçbir sohbeti diske veya veritabanına kaydetmez. Eval CLI ham yanıtları yerel git dışı klasöre yazar. Kullanıcıya gönderilen API yanıtında gizli taslaklar ve Jev sinyalleri bulunmaz.

Eval için production'dan ayrı bir sağlayıcı anahtarı ve istek/token/harcama kotası kullanılmalıdır. Dolar rezervasyonu, paylaşılan hesabın günlük istek sınırını korumaz. İlk 0.1.3 yeniden ölçümünde OpenRouter 403 limit/kota hataları alındı; yeni koşular durduruldu. Aynı anahtarı kullanan uygulamalar da bu sağlayıcı sınırından etkilenebilir; limit kendiliğinden yükseltilmez.

## cenker.dev

Tanıtım `/cenkbot`, sonuçlar `/cenkbot/benchmark`. Standalone servis sayfaları ve `benchmarkView` ile üretilen şema-2 grafik özetini sunar. `/cenkbot/data.json` ham yanıt, istek izi veya runtime/config içermez. Tam değişmez deney kaydı repodaki `eval/public.json` içinde kalır. cenker.dev aynı dönüştürücüyü build sonrası sync scriptinde kullanır; statik snapshot sayesinde site benchmark'ı chatbot servisi kapalıyken de çalışır. Sayfa ziyareti model çağırmaz.

Yayınlanan deney eklendiğinde cenker.dev içindeki snapshot aynı commit/PR ile güncellenmelidir. Sonuç kaynağı GitHub'daki Cenkbot public export'tur; raw üretim konuşmaları değildir. Yeni sonuçların sayfada görünmesi kontrollü snapshot yayınıyla olur; ziyaretçi başına otomatik yeni deney yapılmaz.

Site içinde çalışan mevcut chatbotu yeni servise yönlendirme ayrı bir geçiştir. Yeni çekirdeğin gerçek eval ve persona kabulü bitmeden çalışan cenker.dev chatbotunun yerine konmaz. Yeni repo eski uygulamanın DB ve auth mekanizmalarını taşımaz.

## Güvenlik sınırı

Bu sürüm giriş/rol doğrulaması, body/turn sınırları, model allowlist, API token, timeout/iptal, loglarda secret göstermeme ve public export sınırlaması içerir. Jev soruları ve prompt talimatları tam bir güvenlik garantisi değildir. Yeni profil/scope için injection ve gizlilik kümeleri yeniden değerlendirilmelidir. Agent araçları eklendiğinde yan etki yetkileri ayrıca tasarlanmalıdır.

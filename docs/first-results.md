# İlk deneyler

17 Ekim 2026. Atlas adlı sentetik bisiklet atölyesi profili, sabit 36 soru, her koşul için tek tekrar, aynı yerel Node/Windows ortamı ve dört bağımsız offline test işi. Bu bir genel LLM leaderboard'u veya üretim kabul raporu değildir. İnsan dil/üslup değerlendirmesi henüz yapılmadı.

## On model başlangıcı

Run `2026-10-17T17-34-36-414Z-fbdee0d6`, Cenkbot 0.1.1, commit `5d066e2`. İki selam sorusu hazır yanıttır; bu turlarda model çağrılmaz. API/kota ve kesilme hataları paydadan çıkarılmaz.

| Model | Otomatik geçen | Yanıt alınan | p50 | p95 |
| --- | --- | --- | --- | --- |
| openai/gpt-6-luna | 91.7% | 97.2% | 1.32 sn | 2.42 sn |
| anthropic/claude-haiku-5.5 | 88.9% | 100.0% | 1.27 sn | 2.20 sn |
| qwen/qwen3.7-flash | 5.6% | 5.6% | 3.56 sn | 4.65 sn |
| qwen/qwen3.8-flash | 83.3% | 86.1% | 2.96 sn | 7.08 sn |
| deepseek/deepseek-v4.1-flash-1017 | 91.7% | 100.0% | 1.80 sn | 3.96 sn |
| google/gemini-2.5-flash-lite | 77.8% | 100.0% | 0.65 sn | 0.95 sn |
| google/gemini-3.5-flash-lite | 86.1% | 100.0% | 1.03 sn | 1.82 sn |
| mistralai/mistral-small-3.2-24b-instruct | 80.6% | 100.0% | 1.45 sn | 2.96 sn |
| meta-llama/llama-4-scout | 5.6% | 5.6% | 0.48 sn | 0.83 sn |
| openai/gpt-oss-20b | 72.2% | 94.4% | 3.96 sn | 8.27 sn |

Qwen 3.7 Flash bu token sınırında boş/kesilmiş çıktı üretti; Llama 4 Scout istekleri 429 aldı. Bu sonuçları modellerin genel dil yeteneği gibi okumamak gerekir. Hata ayrıntıları public sonuçlarda saklanır. İlk çalışmada kesilmiş yanıt faturalaması bilinmiyor kaldığı için bazı toplam maliyetler null; 0.1.2 bu kayıt kaybını düzeltti, eski run yeniden yazılmadı.

## Denetim ve düzeltme

Run `2026-10-17T17-37-23-016Z-d175cf53`, Cenkbot 0.1.2, commit `8727753`. Üç adayda baseline/query/guarded/repair/repair2 koşulları: 540 gerçek tur. Bu üç aday ilk yoklamadaki yanıt kullanılabilirliği ve hız çeşitliliği için seçildi; otomatik olarak canlı modele terfi ettirilmedi.

| Model | Tek model | Denetim, düzeltmesiz | Tek düzeltme | İki düzeltme |
| --- | --- | --- | --- | --- |
| openai/gpt-6-luna | 91.7% | 86.1% | 94.4% | 97.2% |
| anthropic/claude-haiku-5.5 | 94.4% | 58.3% | 69.4% | 83.3% |
| google/gemini-2.5-flash-lite | 77.8% | 77.8% | 80.6% | 80.6% |

## Ölçümün ortaya çıkardığı hata

Haiku tek-düzeltme koşulunda birçok ilk taslak objektif kontrolleri geçiyordu; Jev yalnız `concise` gerekçesiyle düzeltme istedi. İkinci taslak yine uzun bulununca doğru bilgi yerine unavailable gönderiliyordu. Tek-düzeltme koşulunda başlangıçta geçen ve düzeltmeye giren yanıtların %88,9'u nihai kontrolde kaybedildi. Bu oran bütün soruların değil, ilgili eşlenmiş alt kümenin oranıdır.

Bu bulgu `policy@2` / 0.1.3 düzeltmesinin gerekçesidir: yalnız kısalık kusuru, düzeltme hakkı bittikten sonra kullanılabilir yanıtı durdurmaz. Yanlış bilgi, dil bozukluğu, non-answer, bağlam ve gizlilik hataları engel olarak kalır. Kabul istisnası `acceptedStyleOnly` ile görünür tutulur.

Tek tekrarın baseline farkları model/sağlayıcı değişkenliğini de içerir; her skor değişimi kodun nedensel etkisi değildir. Düzeltmenin doğrudan etkisi aynı turdaki ilk/son taslak üzerinden incelenir. Daha sağlam sonuç için tekrarlar ve kör insan incelemesi gerekir.

Kaynak: [public deney verisi](../eval/public.json) · [eval protokolü](evaluation.md).

## Yeniden ölçümün sınırı

0.1.3 / `policy@2` aynı üç model ve beş koşulda 540 turla yeniden çalıştırıldı (`2026-10-17T17-41-52-620Z-598c910c`). Ancak 404 OpenRouter isteği HTTP 403 ile reddedildi. Ayrı kısa kontrol OpenRouter tarafında limit/kota kategorisini doğruladı; Jev kontrol çağrısı başarılıydı. Bu nedenle 0.1.3 skor düşüşü kodun kalite gerilemesi veya artışı olarak yorumlanamaz. Koşu silinmedi, erişim hatası açıklamasıyla tutuldu; yeni ücretli koşular durduruldu.

Kısalık düzeltmesi yerel regression testleriyle doğrulandı. Canlı kalite etkisi, production'dan bağımsız eval anahtarı ve sağlıklı erişimle tekrar ölçülmeyi bekliyor. Bütçe kontrolü yalnız dolar cinsinden olmamalı; paylaşılan istek ve token kotası da korunmalı.

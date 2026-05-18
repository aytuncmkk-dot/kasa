# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proje

Ziyade Fasıl restoranı için restoran kasa ve finans yönetim uygulaması. Vanilla JS + Supabase REST, build adımı yok. GitHub Pages'te canlı: `https://aytuncmkk-dot.github.io/kasa/`

## Komutlar

```bash
open index.html          # Tarayıcıda doğrudan aç (local geliştirme)
git push origin main     # GitHub Pages'e deploy (otomatik)
```

## Mimari

`index.html` tek sayfa uygulaması — tüm JS global scope'ta tanımlanır ve sırayla `<script>` etiketleriyle yüklenir. **Yükleme sırası kritiktir:**

```
utils.js → config.js → db.js → audit.js → auth.js
→ kasa.js → fatura.js → cariler.js → inceleme.js → gunluksatis.js
→ yedekfon.js → rapor.js → ozelrapor.js → kardagilim.js → maliyet.js
→ finans.js → uyumsoft.js → vergi.js → eslestirme.js
→ app.js → init.js
```

Yeni modül eklerken `app.js` / `init.js`'ten önce, bağımlı olduğu modüllerden sonra yerleştir.

## Temel Kurallar

- **Tüm fonksiyonlar `var` ve klasik `function` ifadesi kullanır** — arrow function ve `let`/`const` yoktur, bu tutarlılık korunmalıdır.
- **`.bak-*` dosyalarına dokunma** — elle alınan snapshot yedekler, silinmez, düzenlenmez.
- **Veritabanından hiçbir kayıt onay alınmadan silinmez** — `dbDelete` çağrısından önce `confirm()` zorunludur.

## Veri Katmanı (`db.js`)

Tüm Supabase REST çağrıları bu 5 fonksiyondan geçer:

| Fonksiyon | Kullanım |
|-----------|----------|
| `dbGet(tablo, params)` | Sayfalama gerektirmeyen sorgular |
| `dbGetAll(tablo, params)` | 1000+ satır olabilecek tablolar (1000'er kayıt sayfalı) |
| `dbPost(tablo, data)` | INSERT (tek obje — array değil) |
| `dbPatch(tablo, col, val, data)` | UPDATE (eşit filtreli) |
| `dbDelete(tablo, col, val)` | DELETE — her zaman önce onay al |

`getSBH()` — `localStorage`'daki access token'ı tüm isteklere enjekte eder. Token yoksa anon key kullanılır.

## Global State (`config.js`)

```js
kayitlar          // Tüm kasa kayıtları (gelir/gider/dagitim)
faturalar         // Faturalar
fonHareketler     // Yedek fon hareketleri
stoklar, stokHareketleri
avansHareketler   // Ortak avansları — backend tablosu yok, WIP; kardagilim.js'te filtreli
ortaklar
gelirKatlar, giderKatlar, dagitimKatlar
```

## Uygulama Akışı

`init.js` → `oturumKontrol()` → başarılıysa → `yukle()` (`app.js`)

`yukle()` tüm tabloları çeker, `otomatikDagitimMigrasyonu()` çalıştırır, ardından `hepsiniYenile()` tüm render fonksiyonlarını tetikler.

**Sekme geçişi:** `switchTab('tabname')` → `id="pg-{tabname}"` sayfasını gösterir. Her sekmenin kendi render fonksiyonu vardır ve `switchTab` içinde koşulllu olarak çağrılır.

## Global Tarih Filtresi

`aktif-tarih` (başlangıç) + `aktif-tarih-bit` (bitiş) input'ları tüm görünümleri filtreler. `aktifTarihDegisti()` tetiklendiğinde tüm modüllerin filtresi senkronize güncellenir. Değer `localStorage`'a kaydedilir (`kasa_aktif_tarih`, `kasa_aktif_tarih_bit`).

## Yardımcı Fonksiyonlar (`utils.js`)

- `para(n)` — Türk Lirası formatı (`TL 1.234,56`)
- `ldStr(date)` — `YYYY-MM-DD` string (timezone-safe; `toISOString()` kullanma)
- `fmtT(s)` — `YYYY-MM-DD`'yi `tr-TR` locale'inde gösterir
- `normalizePersonelAdi(str)` — ödeme yöntemi eklerini temizler ("APO - BANKA" → "APO")
- `setBag(ok)` — bağlantı göstergesi (yeşil/kırmızı nokta)

## Supabase Tabloları

| Tablo | İçerik |
|-------|--------|
| `kayitlar` | Ana muhasebe defteri — `tur`: `gelir`/`gider`/`dagitim` |
| `faturalar` | Fatura kayıtları |
| `kategoriler` | Kategoriler — `tur`: `gelir`/`gider`/`dagitim` |
| `ortaklar` | Ortak listesi ve hisse yüzdeleri |
| `yedek_fon` | Yedek fon hareketleri |
| `stoklar` + `stok_hareketler` | Stok (modül henüz aktif değil) |
| `cariler` + `cari_hareketler` | Cari hesaplar |
| `adisyon_eslestirme` | Simpra CSV ↔ kasa gelir eşleştirmeleri |

SQL migration'lar `supabase/migrations/` altında — Supabase Dashboard veya CLI ile manuel uygulanır.

## Auth

Google OAuth only. `IZINLI_EMAILS` whitelist `config.js`'te. `ADMIN_EMAILS` yükseltilmiş erişim için (Denetim sekmesi). Access token `localStorage`'da `sb_access_token` olarak tutulur.

## Bekleyen İşler / WIP

- **`otomatikDagitimMigrasyonu()`** (`app.js`): `tur='gider' AND kat='Ortaklara Ödenen'` kayıtlarını `dagitim`'e taşır. Canlı DB'de bu koşulla satır kalmadığı doğrulandıktan sonra bu fonksiyon ve `yukle()` içindeki çağrısı silinebilir.
- **`avansHareketler`**: Tanımlı ama backend tablosu yok, boş array olarak kalır. `kardagilim.js` bu durumu tolere eder.
- **Stok modülü**: `stokEkle()` / `stokHareket()` placeholder'lar — aktif değil.

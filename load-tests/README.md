# k6 Load Test Suite — Ciragan Elite Perde

10.000 kullanıcı altında sistem kapasitesini ve darbogazlari olcen performans test paketi.

---

## Dosya Yapisi

```
load-tests/
  k6/
    config.js                     # URL'ler, test kullanicilari, SLA esikleri
    helpers/
      supabase.js                 # Auth, DB yazma, RPC yardimci fonksiyonlari
    scenarios/
      01-browse.js                # ISR/CDN cache testi — 10.000 VU
      02-checkout.js              # DB yazma stres testi — sabit 200 req/s
      03-state-machine.js         # Concurrent admin islemleri — sabit 50 req/s
    full-load.js                  # Tum senaryolarin birlesmis orkestrasyonu
```

---

## 1. Kurulum

### k6 Yukle

**macOS:**
```bash
brew install k6
```

**Ubuntu/Debian:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

**Windows:**
```powershell
winget install k6
# veya
choco install k6
```

**Dogrulama:**
```bash
k6 version
# k6 v0.53.0 (...)
```

---

## 2. Test Ortami Hazirlama

### Adim 1: Staging ortami kur

**Uretim veritabaninda test YAPMA.** Ayri bir Supabase projesi veya test schema kullan.

Supabase test projesinde migration'lari calistir:
```bash
supabase db push --db-url postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres
```

### Adim 2: Test kullanicilari olustur

Supabase Dashboard > Authentication > Users panelinden 10 kullanici ekle:

| Email | Sifre | Role |
|-------|-------|------|
| loadtest1@ciragan-test.com | TestPass123! | ADMIN |
| loadtest2@ciragan-test.com | TestPass123! | USER |
| ... (3-10) | TestPass123! | USER |

Veya SQL ile toplu olustur:
```sql
-- Supabase SQL Editor'da calistir
DO $$
DECLARE i INT;
BEGIN
  FOR i IN 1..10 LOOP
    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at, role
    ) VALUES (
      gen_random_uuid(),
      'loadtest' || i || '@ciragan-test.com',
      crypt('TestPass123!', gen_salt('bf')),
      NOW(),
      'authenticated'
    );
  END LOOP;
END $$;

-- loadtest1 kullanicisini ADMIN yap
UPDATE profiles
SET role = 'ADMIN'
WHERE email = 'loadtest1@ciragan-test.com';
```

### Adim 3: Test urunleri ekle

Staging ortaminda en az 20 aktif urun olmali. SQL:
```sql
-- Ornek urun ekle (bunu kendi urunlerinizle degistir)
INSERT INTO categories (name, slug) VALUES ('Stor Perde', 'stor-perde') ON CONFLICT DO NOTHING;

INSERT INTO products (name, slug, category_id, base_price_per_m2, is_active)
SELECT
  'Test Perde ' || gs.i,
  'test-perde-' || gs.i,
  (SELECT id FROM categories WHERE slug = 'stor-perde'),
  150.00,
  true
FROM generate_series(1, 20) AS gs(i)
ON CONFLICT (slug) DO NOTHING;
```

### Adim 4: Cevresel degiskenler

`.env.test` dosyasi olustur (asla commit'leme):
```bash
# .env.test
BASE_URL=https://staging.ciragan-elite.com
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. Testleri Calistirma

### Tek Senaryo

```bash
# Cache ve CDN testi (10.000 VU)
k6 run scenarios/01-browse.js \
  --env BASE_URL=https://staging.ciragan-elite.com \
  --env SUPABASE_URL=https://xxx.supabase.co \
  --env SUPABASE_ANON_KEY=eyJ...

# Checkout stres testi (200 req/s)
k6 run scenarios/02-checkout.js \
  --env BASE_URL=... --env SUPABASE_URL=... --env SUPABASE_ANON_KEY=...

# State machine concurrent testi (50 req/s)
k6 run scenarios/03-state-machine.js \
  --env BASE_URL=... --env SUPABASE_URL=... --env SUPABASE_ANON_KEY=...
```

### Tam Yuk Testi (Onerilir)

```bash
# Sonuclari JSON dosyasina kaydet
k6 run full-load.js \
  --env BASE_URL=https://staging.ciragan-elite.com \
  --env SUPABASE_URL=https://xxx.supabase.co \
  --env SUPABASE_ANON_KEY=eyJ... \
  --out json=results/full-load-$(date +%Y%m%d-%H%M).json \
  --summary-trend-stats="min,med,p(90),p(95),p(99),max"
```

### Bulut'ta Calistirma (k6 Cloud — Buyuk Testler Icin)

```bash
# k6 Cloud hesabi ile (ucretsiz 50 VU, ucretli 10k+)
k6 cloud full-load.js \
  --env BASE_URL=... --env SUPABASE_URL=... --env SUPABASE_ANON_KEY=...
```

### Dusmek Debug Modu

```bash
# Sadece 5 VU ile dene, verbose cikti
k6 run scenarios/01-browse.js \
  --vus 5 --duration 30s \
  --http-debug="full" \
  --env BASE_URL=http://localhost:3000 \
  --env SUPABASE_URL=... --env SUPABASE_ANON_KEY=...
```

---

## 4. Metrikleri Yorumlama

### Response Time (Yanit Suresi)

k6 yuzdelik dilimler (percentile) kullanir. Bir e-ticaret sitesi icin beklenen degerler:

| Metrik | Iyi | Kabul edilebilir | Kritik |
|--------|-----|------------------|--------|
| `p(50)` — Median | <200ms | <500ms | >1000ms |
| `p(90)` — 10 kisi/100'den 90'i | <500ms | <1500ms | >2000ms |
| `p(95)` — Erisim hedefi | <800ms | <2000ms | >3000ms |
| `p(99)` — "En kotumuz" | <2000ms | <5000ms | >8000ms |

**p(95)<800ms ne demek?**
100 kullanicidan 95'i 800ms'den hizli yanit aldi. Geriye kalan 5'i daha yavas aldI — bunlar genellikle ilk cache miss, cold start veya edge-case'lerdir.

**Neden p(50) degil p(95)?**
Median (ortalama) yuzde 50'lik dilim yaniltici olabilir. 5 kullanicinin 10 saniye beklemesi ortalamayI cok az etkiler ama musterileri kacirir. p(95) gercek kullanici deneyimini daha iyi gosterir.

---

### Error Rate (Hata Orani)

```
http_req_failed: 0.42% - bu ne anlama geliyor?
```

| Oran | Anlami |
|------|--------|
| <0.1% | Mkemmel — uretimde kabul edilebilir |
| 0.1%-1% | Uyari — arastic, goz at |
| 1%-5% | Kritik — test basarisiz, acil inceleme |
| >5% | Sistem yanit vermiyor |

**Hata turlerini ayirt:**
- `400 Bad Request` → Uygulama mantigi hatasi (validation, state machine reddi) — bu BEKLENEN olabilir
- `401/403` → Auth problemi — token suresi doldu mu?
- `429 Too Many Requests` → Rate limiting devreye girdi — Upstash limitleri ayarla
- `500 Internal Server Error` → Uygulama hatalari — log'lara bak
- `503 Service Unavailable` → **DB connection pool tukendi** (en onemli sinyal)

---

### RPS (Requests Per Second — Saniyedeki Istek Sayisi)

```
http_reqs: 47382 | 52.64/s
```

Bu sayiyi anlamlandirmak icin:

**Beklenen kapasiteler:**
- ISR/CDN cache sayfalar: 5.000-50.000 RPS (Vercel Edge)
- Server rendered sayfalar: 100-500 RPS (Next.js server)
- API/DB yazma: 50-200 RPS (Supabase connection pool = 25-100 baglanti)

**Checkout senaryosunda:**
- 200 req/s hedefledin, 180 req/s ulasabildin → Supabase pool darbogazI
- `dropped_iterations` sayaci artiyorsa: VU sayisi yetersiz, daha fazla VU ekle
- `db_pool_exhausted` artiyorsa: Supabase plan yukselt veya connection pooler (PgBouncer) aktifle

---

### Connection Pool Tukenme (En Kritik Sorun)

```
db_pool_exhausted: 47  ← 47 istek 503 aldi
```

**Tespit:**
- HTTP 503 donusleri artisi
- `http_req_duration` aniden 5-10x yukselir (lock wait)
- k6 terminalde gorme: `state_machine_transition_ms p(99)` 8000ms uzerinde

**Cozum adimlari:**
1. Supabase dashboard > Settings > Database: "Pool Size" degerini gor
2. Free tier: 25 baglanti — cok az
3. Pro tier: 100 baglanti — orta yuk icin yeterli
4. PgBouncer (Supabase built-in): `SUPABASE_DB_URL?pgbouncer=true` ile etkinlestir
5. Baglanti sadece transaction icinde tut — server action'larda `await`'i erken birakma

---

### Cache Hit Rate

```
cache_hit_rate: 82.3%
```

| Oran | Anlami |
|------|--------|
| >90% | ISR iyi calisIyor, Vercel Edge/CDN optimize |
| 70-90% | Normal — bazi cache miss'ler beklenir |
| <70% | ISR `revalidate` surelerini artir veya `stale-while-revalidate` ekle |
| <50% | Buyuk problem — `no-store` header var mi kontrol et |

**Cache hit nasil artar?**
- `export const revalidate = 3600` (1 saat) ISR — urunler cok degismiyorsa
- `next/headers` kullanan server component'ler cache'lenemez — `cookies()` cagrilarini izole et
- Vercel Dashboard > Functions > Caching sekmesini kontrol et

---

### Event Loop Blokajı (Sadece gelistirme ortami icin)

Uretimde Vercel serverless oldugu icin Event Loop blokaji olmaz. Ama yerel Node.js sunucu kullaniyorsan:

```
http_req_duration p(99) > 10000ms  +  error rate > 5%
```

Bu kombinasyon Event Loop'un bloke oldugunu gosterebilir:
- Buyuk JSON parse/stringify islemleri (`JSON.parse` 10MB veri)
- `fs.readFileSync` veya senkron kriptografi islemleri
- CPU-bound loop'lar (siralalama, hesaplama)

**Tespit:** `clinic.js` veya `0x` ile flame graph al, bloklayan fonksiyonu bul.

---

## 5. Test Sonrasi Temizlik

Test siparisleri teardown'da otomatik silinir. Ama test sirasinda sistem patlarsa manuel temizle:

```sql
-- Test siparislerini temizle
DELETE FROM orders WHERE customer_email LIKE '%@ciragan-test.com';

-- Test kullanicilarin cart'larini temizle
DELETE FROM cart_items ci
USING carts c
JOIN auth.users u ON u.id = c.user_id
WHERE ci.cart_id = c.id AND u.email LIKE '%@ciragan-test.com';
```

---

## 6. Sonuclari Kaydetme ve Karsilastirma

### JSON ciktisi analiz

```bash
# Basit ozet
cat results/full-load-20240315-1430.json | \
  jq '.metrics["http_req_duration"].values | {p95, p99, max}'
```

### k6 Dashboard (gercek zamanli)

```bash
# Terminalde canli grafik icin
k6 run full-load.js \
  --env BASE_URL=... \
  --out web-dashboard
# Tarayicide: http://localhost:5665
```

### Grafana Entegrasyonu (Uzun vadeli)

```bash
# InfluxDB + Grafana stack
k6 run full-load.js \
  --out influxdb=http://localhost:8086/k6
```

Grafana'da `k6` datasource'u ekle, resmi k6 dashboard'u import et (ID: 2587).

---

## 7. Hizli Referans: Threshold Yorumu

Test bittikten sonra terminalda su ciktiyi gorursun:

```
✓ http_req_failed............: 0.23%  ✓ rate<0.01
✗ checkout_success_rate......: 88.1%  ✗ rate>0.90   ← BASARISIZ
✓ cache_hit_rate.............: 83.2%  ✓ rate>0.75
✓ http_req_duration p(95)....: 742ms  ✓ p(95)<800
✗ db_pool_exhausted..........: 73     ✗ count<50    ← BASARISIZ
```

- `✓` = Threshold gecti, sistem bu metric altinda saglIkli
- `✗` = Threshold basarisiz — bu alandaki darbogazI oncelikli incele

Yukaridaki ornekte: `checkout_success_rate` dusuk + `db_pool_exhausted` yuksek = **Supabase connection pool darbogazI**. Cozu: PgBouncer aktifle veya plan yukselt.

# Iron Lounge · Mesai Takip

Ayrı bir backend yok: **statik frontend (`public/`) + PostgreSQL (`supabase/schema.sql`)**.
Tüm kurallar (50 m konum kontrolü, 4 haneli kodlar, geç kalma, admin oturumu) veritabanındaki
SQL fonksiyonlarında çalışır. Tablolar dışarıya kapalıdır; tarayıcı sadece bu fonksiyonları çağırabilir.

## Sayfalar
- `index.html` — Personel ekranı. İlk açılışta 4 haneli kod girilir, telefon kişiyi hatırlar.
  Sonra tek bir **Mesaiye Başla** butonu var; işyerine 50 m'den uzaksa giriş yapılamaz.
- `admin.html` — Yönetim paneli (varsayılan şifre `admin1234`, ilk girişte **Ayarlar**'dan değiştirin).
  - **Şu An:** kim mesaide, bugünkü hakediş, çıkış yaptırma, gerekirse konumsuz manuel giriş
  - **Personel:** ekle; giriş kodu elle (4 hane) ya da otomatik; varsayılan vardiya, saatlik ücret, haftalık izin günleri
  - **Vardiyalar:** istediğin kadar vardiya (ad, başlangıç, bitiş; gece yarısını geçebilir)
  - **Takvim:** personel × gün — zamanında / kaç dk geç / gelmedi / izinli. Güne tıklayınca:
    o günün vardiyasını değiştir, kaydı düzenle ya da unutulan kaydı ekle, izin ver/kaldır
  - **Kayıtlar:** her girişin saatini, vardiyasını ve ücretini sonradan düzenle; Excel (CSV)
  - **Hakediş:** çalışılan süre × saatlik ücret; personel bazında toplam ve günlük döküm, Excel (CSV)
  - **Ayarlar:** işyeri konumu ve yarıçap, admin şifresi

Her kayıt, giriş anındaki vardiyayı ve saatlik ücreti saklar: vardiya saatini ya da ücreti sonradan
değiştirmek geçmiş günlerin geç kalma ve hakediş hesabını bozmaz.

## Kurulum (Supabase, ücretsiz plan yeterli)
1. supabase.com'da proje açın.
2. **SQL Editor** → `supabase/schema.sql` dosyasının tamamını yapıştırıp **Run**.
   (Tekrar çalıştırmak güvenlidir, veriyi silmez — güncellemelerde aynı dosyayı yeniden çalıştırın.)
3. **Project Settings → API**'den Project URL ve anon/publishable key'i `public/config.js`'e yazın.
4. `public/` klasörünü herhangi bir statik hostinge yükleyin (Netlify Drop, Vercel, Cloudflare Pages, GitHub Pages).

> **HTTPS şart:** telefonlar konum iznini yalnızca `https://` sitelerde verir. Yukarıdaki hostingler bunu otomatik sağlar.

Personel linki: `https://siteniz/` · Admin linki: `https://siteniz/admin.html`

## Lokal çalıştırma
PostgreSQL + PostgREST kurulu olmalı (`brew install postgresql@18 postgrest`).
```
createdb ironlounge && psql -d ironlounge -f supabase/schema.sql
postgrest local/postgrest.conf          # :3001
cd public && python3 -m http.server 5500
```
`localhost`'ta açılınca `config.js` otomatik olarak yerel PostgREST'e bağlanır.

## Kendi PostgreSQL sunucunuzla
`schema.sql`'i `psql -f supabase/schema.sql` ile çalıştırın, önüne PostgREST koyun
(`db-anon-role = "anon"`), `config.js`'te `REST_URL`'i PostgREST adresine ayarlayın.

## Notlar
- Telefon GPS'i bina içinde 10–30 m sapabilir. Personel kapıda reddediliyorsa Ayarlar'dan yarıçapı biraz artırın
  veya admin "Manuel giriş" yapsın.
- Personel kodu sızarsa Personel sekmesinden **Yeni kod** ile değiştirin.

# Iron Lounge · Mesai Takip

Ayrı bir backend kodu yok: **Next.js (statik çıktı) + PostgreSQL (`db/schema.sql`) + PostgREST**.
Tüm kurallar (50 m konum kontrolü, 4 haneli kodlar, geç kalma, hakediş, admin oturumu) veritabanındaki
SQL fonksiyonlarında çalışır. Tablolar dışarıya kapalıdır; tarayıcı sadece bu fonksiyonları çağırabilir.

## Proje yapısı
```
app/page.js            Personel ekranı (/)
app/admin/page.js      Yönetim paneli (/admin)
app/globals.css        Tasarım sistemi
components/StaffApp.js Personel ekranı bileşenleri
components/admin/      Panel sekmeleri ve diyaloglar
lib/api.js             PostgREST RPC çağrısı
lib/format.js          Tarih, süre, para biçimleri
db/schema.sql          Tüm veri ve iş kuralları (SQL fonksiyonları)
Dockerfile, Caddyfile  Canlı yayın: Next.js derlenir, Caddy sunar ve /api'yi PostgREST'e iletir
```

## Sayfalar
- `/` — Personel ekranı. İlk açılışta 4 haneli kod girilir, telefon kişiyi hatırlar.
  Sonra tek bir buton var: **Mesaiye başla**, mesaideyken **Mesaiyi bitir** (ikinci dokunuşla onay).
  Giriş de çıkış da sadece işyerinde (50 m içinde) yapılabilir.
  Gizlilik: personel ekranında (ve herkese açık API'de) sadece ilk ad ve "mesaide mi" bilgisi vardır;
  vardiya, saat, geç kalma, ücret gibi her şey yalnızca admin oturumuyla okunabilir.
- `/admin` — Yönetim paneli.
  - **Şu An:** kim mesaide, bugünkü hakediş, çıkış yaptırma, gerekirse konumsuz manuel giriş
  - **Personel:** ekle; giriş kodu elle (4 hane) ya da otomatik; varsayılan vardiya, saatlik ücret, haftalık izin günleri
  - **Vardiyalar:** istediğin kadar vardiya (ad, başlangıç, bitiş; gece yarısını geçebilir)
  - **Takvim:** personel × gün — zamanında / kaç dk geç / gelmedi / izinli. Güne tıklayınca:
    o günün vardiyasını değiştir, kaydı düzenle ya da unutulan kaydı ekle, izin ver/kaldır
  - **Kayıtlar:** her girişin saatini, vardiyasını ve ücretini sonradan düzenle; Excel (CSV)
  - **Hakediş:** aylık; saatlik çalışanda süre × ücret, maaşlıda aylık maaş. Aylık hedef saat girilenlerde
    doldurulan/eksik saat. Günlük döküm, Excel (CSV)
  - **Ayarlar:** işyeri konumu ve yarıçap, admin şifresi

Her kayıt, giriş anındaki vardiyayı ve saatlik ücreti saklar: vardiya saatini ya da ücreti sonradan
değiştirmek geçmiş günlerin geç kalma ve hakediş hesabını bozmaz.

## Railway'de yapı
| Servis | Ne yapar |
|---|---|
| **mesai-takip** | Bu depodan `Dockerfile` ile derlenir (Next.js statik çıktı). Caddy sayfaları sunar, `/api/rpc/*` isteklerini `api` servisine iletir ve gerçek istemci IP'sini `X-Client-IP` başlığıyla veritabanına geçirir. Her `git push` ile otomatik yayınlanır. |
| **api** | `postgrest/postgrest` imajı. İnternete açık değil, sadece özel ağdan erişilir. `authenticator` rolüyle bağlanır, istekleri `anon` rolüyle çalıştırır. |
| **Postgres** | Veriler. |

`api` servisinin değişkenleri: `PGRST_DB_URI`, `PGRST_DB_SCHEMAS=public`, `PGRST_DB_ANON_ROLE=anon`,
`PGRST_SERVER_HOST=*6`, `PGRST_SERVER_PORT=3000`, `PGRST_OPENAPI_MODE=disabled`.
`mesai-takip` servisinin değişkeni: `API_UPSTREAM=${{api.RAILWAY_PRIVATE_DOMAIN}}:3000`.

## Admin şifresi
Varsayılan şifre yok; güvenlik için şifre internetten değil, sadece veritabanından belirlenir:
```
railway connect Postgres
select set_admin_password('güçlü-bir-şifre');
```
Şifreyi unutursanız aynı komutla sıfırlayın. Giriş kilitlenirse: `select admin_unlock();`

## Şema güncelleme
`db/schema.sql` tekrar çalıştırılabilir; veriyi silmez, eski sürümden otomatik taşır:
```
psql "$DATABASE_PUBLIC_URL" -f db/schema.sql
```

## Lokal çalıştırma
PostgreSQL + PostgREST kurulu olmalı (`brew install postgresql@18 postgrest`).
```
npm install
createdb ironlounge && psql -d ironlounge -f db/schema.sql
psql -d ironlounge -c "select set_admin_password('güçlü-bir-şifre')"
postgrest local/postgrest.conf          # :3001
npm run dev                             # http://localhost:3000
```
API adresi `NEXT_PUBLIC_API_URL` ile verilir: lokalde `.env.development` (localhost:3001),
canlıda varsayılan `/api` (Caddy iletir). Gizli anahtar yok.

## Notlar
- Telefonlar konum iznini yalnızca `https://` sitelerde verir (Railway alan adı HTTPS'tir).
- Telefon GPS'i bina içinde 10–30 m sapabilir. Personel kapıda reddediliyorsa Ayarlar'dan yarıçapı biraz artırın
  veya admin "Manuel giriş" yapsın.
- Personel kodu sızarsa Personel sekmesinden kodu değiştirin.

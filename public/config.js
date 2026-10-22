// Veritabanı bağlantısı — Supabase > Project Settings > API (veya Data API) sayfasından alın.
// anon / publishable anahtarın herkese açık olması sorun değil: tablolar kapalı,
// sadece schema.sql'deki fonksiyonlar çağrılabilir.
window.IRON_CONFIG = {
  SUPABASE_URL: 'https://PROJE-ID.supabase.co',
  SUPABASE_ANON_KEY: 'BURAYA-ANON-KEY',
  // Supabase yerine kendi PostgREST sunucunuzu kullanırsanız:
  // REST_URL: 'https://api.alanadiniz.com',
};

// Lokal geliştirme: localhost'ta açılınca yerel PostgREST'e bağlan
if (['localhost', '127.0.0.1'].includes(location.hostname)) {
  window.IRON_CONFIG = { REST_URL: 'http://localhost:3001', SUPABASE_ANON_KEY: 'local' };
}

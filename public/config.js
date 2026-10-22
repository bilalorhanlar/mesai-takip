// API adresi. Canlıda site ve API aynı adreste: web sunucusu (Caddyfile) /api isteklerini
// PostgREST'e iletir. Bu yüzden burada gizli bir anahtar ya da adres yoktur.
window.IRON_CONFIG = { REST_URL: '/api' };

// Lokal geliştirme: python3 -m http.server ile açılınca yerel PostgREST'e bağlan
if (['localhost', '127.0.0.1'].includes(location.hostname) && location.port !== '8080') {
  window.IRON_CONFIG = { REST_URL: 'http://localhost:3001' };
}

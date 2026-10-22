// PostgreSQL'e PostgREST üzerinden doğrudan RPC çağrısı. Ayrı backend yok.
// Canlıda site ve API aynı adreste (/api, Caddyfile iletir); lokalde .env.development.
const BASE = (process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/$/, '');

export async function rpc(fn, args = {}) {
  let r;
  try {
    r = await fetch(`${BASE}/rpc/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
  } catch {
    throw new Error('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
  }
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) {
    const err = new Error((data && data.message) || 'Bir hata oluştu');
    err.auth = err.message === 'AUTH_REQUIRED';
    throw err;
  }
  return data;
}

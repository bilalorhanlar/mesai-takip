// PostgreSQL'e (Supabase / PostgREST) doğrudan RPC çağrısı. Ayrı backend yok.
async function rpc(fn, args = {}) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY: key, REST_URL } = window.IRON_CONFIG || {};
  // Supabase: <url>/rest/v1 · Kendi PostgREST sunucunuz: REST_URL
  const base = (REST_URL || `${SUPABASE_URL}/rest/v1`).replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json', apikey: key };
  if (key && key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key; // eski JWT tipi anon key
  let r;
  try {
    r = await fetch(`${base}/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
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

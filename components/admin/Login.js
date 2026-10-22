'use client';

import { useEffect, useState } from 'react';
import { rpc } from '@/lib/api';

export default function Login({ onLogin, initialError = '' }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(initialError);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => { rpc('admin_needs_setup').then(setNeedsSetup).catch(() => {}); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await rpc('admin_login', { p_password: pw });
      if (res.error === 'SETUP_REQUIRED') return setNeedsSetup(true);
      if (res.error) throw new Error(res.error);
      setPw(''); onLogin(res.token);
    } catch (e2) { setErr(e2.message); }
  };

  return (
    <section className="login">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo-dark.png" alt="Iron Lounge" className="login-logo" />
        <p className="login-sub">{needsSetup ? 'İlk kurulum' : 'Yönetim Paneli'}</p>
        {needsSetup ? (
          // Şifre güvenlik için internetten değil, yalnızca veritabanından belirlenir
          <div className="login-note">
            Admin şifresi henüz belirlenmemiş. Güvenlik için şifre panelden değil, veritabanından belirlenir.
            Bilgisayarınızda proje klasöründe <code>railway connect Postgres</code> çalıştırın, açılan ekrana şunu yazın:
            <code>select set_admin_password(&apos;güçlü-bir-şifre&apos;);</code>
            Sonra bu sayfayı yenileyin.
          </div>
        ) : (
          <>
            <input type="password" placeholder="Admin şifresi" autoComplete="current-password" required autoFocus
              value={pw} onChange={(e) => setPw(e.target.value)} />
            <button className="btn primary">Giriş</button>
          </>
        )}
        <p className="msg err">{err}</p>
      </form>
    </section>
  );
}

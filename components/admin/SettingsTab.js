'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './context';

export default function SettingsTab() {
  const { api, state, afterChange } = useAdmin();
  const s = state.settings;
  const [loc, setLoc] = useState({ lat: String(s.lat), lng: String(s.lng), radius: String(s.radius) });
  const [locMsg, setLocMsg] = useState(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState(null);
  useEffect(() => setLoc({ lat: String(s.lat), lng: String(s.lng), radius: String(s.radius) }), [s.lat, s.lng, s.radius]);

  const flash = (setter, text, ok = true) => { setter({ text, ok }); if (ok) setTimeout(() => setter((m) => (m?.text === text ? null : m)), 5000); };
  const setL = (k) => (e) => setLoc((v) => ({ ...v, [k]: e.target.value }));

  const saveLoc = async (e) => {
    e.preventDefault();
    try { await api('admin_update_settings', { p_lat: Number(loc.lat), p_lng: Number(loc.lng), p_radius: Number(loc.radius) }); flash(setLocMsg, 'Konum kaydedildi'); afterChange(); }
    catch (err) { flash(setLocMsg, err.message, false); }
  };
  const here = () => {
    if (!navigator.geolocation) return flash(setLocMsg, 'Konum desteklenmiyor', false);
    flash(setLocMsg, 'Konum alınıyor…');
    navigator.geolocation.getCurrentPosition((p) => {
      setLoc((v) => ({ ...v, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) }));
      flash(setLocMsg, `Konum alındı (±${Math.round(p.coords.accuracy)} m). Kaydet'e basın.`);
    }, (err) => flash(setLocMsg, 'Konum alınamadı: ' + err.message, false), { enableHighAccuracy: true, timeout: 20000 });
  };
  const savePw = async (e) => {
    e.preventDefault();
    try { await api('admin_change_password', { p_current: pw.current, p_next: pw.next }); setPw({ current: '', next: '' }); flash(setPwMsg, 'Şifre değiştirildi'); }
    catch (err) { flash(setPwMsg, err.message, false); }
  };

  return (
    <>
      <h1 className="page-title">Ayarlar</h1>
      <p className="page-sub">Personel yalnızca bu konumun belirtilen yarıçapı içindeyken giriş yapabilir.</p>
      <h2>İşyeri konumu</h2>
      <form className="card row-form" onSubmit={saveLoc}>
        <label>Enlem<input type="number" step="any" value={loc.lat} onChange={setL('lat')} required /></label>
        <label>Boylam<input type="number" step="any" value={loc.lng} onChange={setL('lng')} required /></label>
        <label>Yarıçap (m)<input type="number" min="10" max="5000" value={loc.radius} onChange={setL('radius')} required /></label>
        <button className="btn primary">Kaydet</button>
        <button type="button" className="btn" onClick={here}>Şu anki konumumu kullan</button>
      </form>
      {locMsg && <p className={`msg ${locMsg.ok ? 'ok' : 'err'}`}>{locMsg.text}</p>}
      <p className="note"><a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noopener noreferrer">Haritada göster ↗</a></p>

      <h2>Admin şifresi</h2>
      <form className="card row-form" onSubmit={savePw}>
        <label>Mevcut şifre<input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((v) => ({ ...v, current: e.target.value }))} required /></label>
        <label>Yeni şifre<input type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw((v) => ({ ...v, next: e.target.value }))} required /></label>
        <button className="btn primary">Değiştir</button>
      </form>
      {pwMsg && <p className={`msg ${pwMsg.ok ? 'ok' : 'err'}`}>{pwMsg.text}</p>}
    </>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rpc } from '@/lib/api';
import { AdminContext } from './context';
import CalendarTab from './CalendarTab';
import CheckoutDialog from './CheckoutDialog';
import Login from './Login';
import NowTab from './NowTab';
import PayTab from './PayTab';
import RecordDialog from './RecordDialog';
import RecordsTab from './RecordsTab';
import SettingsTab from './SettingsTab';
import ShiftsTab from './ShiftsTab';
import StaffTab from './StaffTab';

const TOKEN_KEY = 'ironlounge_admin';
const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch {} };

const TABS = [
  ['now', 'Şu An'], ['staff', 'Personel'], ['shifts', 'Vardiyalar'], ['calendar', 'Takvim'],
  ['records', 'Kayıtlar'], ['pay', 'Hakediş'], ['settings', 'Ayarlar'],
];

export default function AdminApp() {
  const [phase, setPhase] = useState('boot'); // boot | login | app
  const [loginError, setLoginError] = useState('');
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('now');
  const [version, setVersion] = useState(0); // veri değişince sekmeler yeniden yüklenir
  const [toastMsg, setToastMsg] = useState(null);
  const [recDlg, setRecDlg] = useState(null); // { rec, preset }
  const [outDlg, setOutDlg] = useState(null); // { id, name, checkIn }
  const toastT = useRef(null);

  const toast = useCallback((text, ok = true) => {
    clearTimeout(toastT.current);
    setToastMsg({ text, ok });
    toastT.current = setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const toLogin = useCallback((error = '') => { setToken(null); setState(null); setLoginError(error); setPhase('login'); }, []);

  // Admin SQL fonksiyonu çağrısı (oturum token'ı ile); oturum düşerse girişe döner
  const api = useCallback(async (fn, args = {}) => {
    try { return await rpc(fn, { p_token: getToken(), ...args }); }
    catch (e) { if (e.auth) { toLogin(); throw new Error('Giriş gerekli'); } throw e; }
  }, [toLogin]);

  const load = useCallback(async () => { setState(await api('admin_state')); }, [api]);
  const afterChange = useCallback(() => { setVersion((v) => v + 1); load().catch(() => {}); }, [load]);

  const boot = useCallback(async () => {
    if (!getToken()) return toLogin();
    try { await load(); setPhase('app'); }
    catch (err) { if (err.message !== 'Giriş gerekli') toLogin(err.message); }
  }, [load, toLogin]);
  useEffect(() => { boot(); }, [boot]);

  // Her 30 sn'de bir yenile (Şu An sekmesinde ve pencere açık değilken)
  useEffect(() => {
    if (phase !== 'app') return;
    const t = setInterval(() => {
      if (tab === 'now' && !recDlg && !outDlg && !document.querySelector('dialog[open]')) load().catch(() => {});
    }, 30000);
    return () => clearInterval(t);
  }, [phase, tab, recDlg, outDlg, load]);

  const ctx = useMemo(() => ({
    api, state, version, toast, afterChange,
    openRecord: (rec, preset = {}) => setRecDlg({ rec, preset }),
    openCheckout: (id, name, checkIn) => setOutDlg({ id, name, checkIn }),
  }), [api, state, version, toast, afterChange]);

  const logout = async () => { await rpc('admin_logout', { p_token: getToken() }).catch(() => {}); toLogin(); };

  if (phase === 'boot') return <div className="admin-page" />;
  if (phase === 'login' || !state) {
    return <div className="admin-page"><Login initialError={loginError} onLogin={(t) => { setToken(t); setLoginError(''); boot(); }} /></div>;
  }

  return (
    <AdminContext.Provider value={ctx}>
      <div className="admin-page">
        <header className="topbar">
          <img src="/logo-dark.png" alt="Iron Lounge" className="top-logo" />
          <nav className="tabs">
            {TABS.map(([id, label]) => (
              <button key={id} className={tab === id ? 'active' : undefined} onClick={() => setTab(id)}>{label}</button>
            ))}
          </nav>
          <button className="btn ghost" onClick={logout}>Çıkış</button>
        </header>

        <main className="content">
          <section hidden={tab !== 'now'}><NowTab /></section>
          <section hidden={tab !== 'staff'}><StaffTab /></section>
          <section hidden={tab !== 'shifts'}><ShiftsTab /></section>
          <section hidden={tab !== 'calendar'}><CalendarTab active={tab === 'calendar'} /></section>
          <section hidden={tab !== 'records'}><RecordsTab active={tab === 'records'} /></section>
          <section hidden={tab !== 'pay'}><PayTab active={tab === 'pay'} /></section>
          <section hidden={tab !== 'settings'}><SettingsTab /></section>
        </main>

        {recDlg && <RecordDialog rec={recDlg.rec} preset={recDlg.preset} onClose={() => setRecDlg(null)} />}
        {outDlg && <CheckoutDialog target={outDlg} onClose={() => setOutDlg(null)} />}
        <div className={`toast${toastMsg ? ' show' : ''}${toastMsg && !toastMsg.ok ? ' err' : ''}`}>{toastMsg?.text}</div>
      </div>
    </AdminContext.Provider>
  );
}

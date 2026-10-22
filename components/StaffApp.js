'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '@/lib/api';
import { TZ, tFmt } from '@/lib/format';

const KEY = 'ironlounge_staff';
const getMe = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const setMe = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };
const buzz = (p) => { try { navigator.vibrate?.(p); } catch {} };
const firstName = (n = '') => n.split(' ')[0];

// SQL fonksiyonları {status, ...} döner
async function call(fn, args) {
  const data = await rpc(fn, args);
  return { ok: data.status === 200, status: data.status, data };
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Bu cihaz konum desteklemiyor'));
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      const m = { 1: 'Konum izni verilmedi. Tarayıcı ayarlarından konum iznini açın.', 2: 'Konum bulunamadı. GPS açık mı?', 3: 'Konum zaman aşımı. Tekrar deneyin.' };
      reject(new Error(m[err.code] || 'Konum alınamadı'));
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

const Icon = ({ name }) => (
  <svg className="ico" viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {name === 'play' && <><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l5.5-3.5z" /></>}
    {name === 'pin' && <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>}
    {name === 'check' && <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.8 2.8L16.5 9.5" /></>}
  </svg>
);

function Clock() {
  const [now, setNow] = useState(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(t); }, []);
  return (
    <div className="clock">
      <span className="clock-time">{now ? now.toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
      <span className="clock-date">{now ? now.toLocaleDateString('tr-TR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }) : ' '}</span>
    </div>
  );
}

function greeting() {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }));
  return h < 12 ? 'Günaydın' : h < 18 ? 'İyi günler' : 'İyi akşamlar';
}

// ---- Kod girişi (ilk kullanım) ----
function CodeView({ onIdentified, initialError }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState(initialError || '');
  const [shake, setShake] = useState(false);

  const press = async (k) => {
    buzz(8);
    setErr('');
    if (k === 'del') return setCode((c) => c.slice(0, -1));
    if (code.length >= 4) return;
    const next = code + k;
    setCode(next);
    if (next.length < 4) return;
    const { ok, data } = await call('staff_status', { p_code: next }).catch((e) => ({ ok: false, data: { error: e.message } }));
    if (ok) { setMe({ code: next, name: data.name }); onIdentified(data); return; }
    buzz([40, 40, 40]);
    setErr(data.error || 'Hata');
    setShake(true);
    setTimeout(() => { setShake(false); setCode(''); }, 450);
  };

  return (
    <section className="view">
      <h1 className="title">Personel kodunuzu girin</h1>
      <p className="hint">Bu telefonda bir kez sorulur.</p>
      <div className={`dots${shake ? ' shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={i < code.length ? 'on' : ''} />)}
      </div>
      <p className="msg err">{err}</p>
      <div className="pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => press(d)}>{d}</button>)}
        <span />
        <button onClick={() => press('0')}>0</button>
        <button data-k="del" aria-label="Sil" onClick={() => press('del')}>⌫</button>
      </div>
    </section>
  );
}

// ---- Başarı animasyonu ----
const CONFETTI_COLORS = ['#3b4a2c', '#9a9364', '#d8d2ad', '#56663f', '#c9c3a0'];
function SuccessView({ data, name }) {
  const [pieces] = useState(() => Array.from({ length: 26 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 26 + Math.random() * 0.3, dist = 110 + Math.random() * 90;
    return {
      '--x': `${Math.cos(a) * dist}px`, '--y': `${Math.sin(a) * dist}px`, '--r': `${Math.random() * 540 - 270}deg`,
      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length], animationDelay: `${0.25 + Math.random() * 0.15}s`,
      borderRadius: i % 3 ? undefined : '50%',
    };
  }));
  return (
    <section className="view stagger">
      <div className="success">
        <svg className="success-mark" viewBox="0 0 200 200" aria-hidden="true">
          <circle className="close" cx="100" cy="100" r="88" />
          <path className="tick" d="M70 103 l22 22 l40 -46" />
        </svg>
        {pieces.map((style, i) => <span key={i} className="confetti" style={style} />)}
      </div>
      <p className="ok-title">İyi çalışmalar, {firstName(name)}</p>
      <p className="ok-time">{tFmt(data.checkIn)}</p>
      <p className={data.late > 0 ? 'ok-sub msg late' : 'ok-sub'}>
        {data.late > 0 ? `${data.late} dk geç giriş kaydedildi` : 'Girişiniz kaydedildi'}
      </p>
    </section>
  );
}

// ---- Mesaiye başla ----
function MainView({ info, onCheckedIn, onInvalidCode, onShiftUpdate }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [msg, setMsg] = useState(null);
  const on = !!info.onShift;

  const times = `${info.shiftStart} – ${info.shiftEnd}`;
  // Vardiya adı zaten saatlerden oluşuyorsa tekrar etme
  const shiftText = !info.shiftStart ? '' : !info.shiftName || info.shiftName.includes(info.shiftStart) ? `Vardiya ${times}` : `${info.shiftName} vardiyası, ${times}`;
  const note = msg || (info.onLeave && !on ? { text: 'Bugün izin gününüz 🌿' } : null);

  const start = async () => {
    const me = getMe(); if (!me) return onInvalidCode();
    buzz(15);
    setBusy(true); setMsg(null);
    try {
      const pos = await getPosition();
      const { ok, status, data } = await call('staff_checkin', { p_code: me.code, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_accuracy: pos.coords.accuracy });
      setBusy(false);
      if (ok) return onCheckedIn(data);
      if (status === 404) return onInvalidCode('Kodunuz geçersiz, tekrar girin.');
      if (status === 409) return onShiftUpdate({ onShift: true, checkIn: data.checkIn });
      throw new Error(data.error || 'Giriş yapılamadı');
    } catch (e) {
      setBusy(false); setFailed(true);
      buzz([40, 40, 40]);
      setMsg({ text: e.message, err: true });
    }
  };

  return (
    <section className="view">
      <h1 className="hello">{greeting()},<br /><em>{firstName(info.name)}</em></h1>
      {shiftText && <span className="shift">{shiftText}</span>}
      <div className={`start-zone${on ? ' done' : ''}${busy ? ' busy' : ''}`}>
        <svg className="stroke-ring" viewBox="0 0 240 240" aria-hidden="true">
          <circle className="arc" cx="120" cy="120" r="112" />
        </svg>
        <button className={`start${on ? ' done' : ''}${busy ? ' busy' : ''}`} disabled={on || busy} onClick={start}>
          <Icon name={on ? 'check' : busy ? 'pin' : 'play'} />
          <span className="lbl">
            {on ? 'Mesaidesiniz' : busy ? <>Konum<br />alınıyor</> : failed ? <>Tekrar<br />dene</> : <>Mesaiye<br />başla</>}
          </span>
          {on && <span className="sub">{tFmt(info.checkIn)} itibarıyla</span>}
        </button>
      </div>
      <p className={`msg${note?.err ? ' err' : ''}`}>{note?.text}</p>
    </section>
  );
}

export default function StaffApp() {
  const [view, setView] = useState('loading'); // loading | code | main | ok
  const [info, setInfo] = useState(null);
  const [okData, setOkData] = useState(null);
  const [codeError, setCodeError] = useState('');
  const okTimer = useRef(null);

  const toCode = useCallback((error = '') => { setMe(null); setCodeError(error); setView('code'); }, []);

  const refresh = useCallback(async () => {
    const me = getMe();
    if (!me) return toCode();
    const { ok, status, data } = await call('staff_status', { p_code: me.code }).catch(() => ({ ok: false }));
    if (ok) { setMe({ ...me, name: data.name }); setInfo(data); setView('main'); }
    else if (status === 404) toCode();
    else { setInfo((i) => i || { name: me.name }); setView('main'); } // çevrimdışı vb.
  }, [toCode]);

  useEffect(() => {
    refresh();
    const onVis = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); clearTimeout(okTimer.current); };
  }, [refresh]);

  const onCheckedIn = (data) => {
    setOkData(data); setView('ok');
    buzz([30, 60, 80]);
    okTimer.current = setTimeout(refresh, 7000);
  };

  return (
    <div className="staff-page">
      <main className="staff-wrap">
        <header className="staff-head">
          <img src="/logo-dark.png" alt="Iron Lounge" className="staff-logo" />
          <Clock />
        </header>
        <div className="staff-body">
          {view === 'code' && <CodeView initialError={codeError} onIdentified={(d) => { setInfo(d); setView('main'); }} />}
          {view === 'main' && info && (
            <MainView info={info} onCheckedIn={onCheckedIn} onInvalidCode={toCode}
              onShiftUpdate={(u) => setInfo((i) => ({ ...i, ...u }))} />
          )}
          {view === 'ok' && okData && <SuccessView data={okData} name={okData.name || info?.name || ''} />}
        </div>
      </main>
    </div>
  );
}

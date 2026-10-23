'use client';

import { durFmt, initials, minsBetween, money, shiftTimes, tFmt, TZ } from '@/lib/format';
import { useAdmin } from './context';
import RecordTable from './RecordTable';
import Stats from './Stats';

export default function NowTab() {
  const { state, api, toast, afterChange, openCheckout } = useAdmin();
  const on = state.staff.filter((s) => s.onShift);
  const earned = state.today.reduce((a, r) => a + Number(r.earning), 0);

  const manual = async (s) => {
    if (!confirm(`${s.name} için konum kontrolü olmadan giriş yapılsın mı?`)) return;
    try { await api('admin_manual_checkin', { p_id: s.id }); toast('Giriş yapıldı'); afterChange(); }
    catch (err) { toast(err.message, false); }
  };

  return (
    <>
      <h1 className="page-title">Bugün</h1>
      <p className="page-sub">{new Date().toLocaleDateString('tr-TR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <Stats items={[
        { label: 'Şu an mesaide', value: on.length, accent: true },
        { label: 'Bugün giriş', value: state.today.length },
        { label: 'Geç kalan', value: state.today.filter((r) => r.late > 0).length },
        { label: 'Bugünkü saatlik hakediş', value: money(earned), money: true },
      ]} />

      <h2>Personel durumu</h2>
      <div className="table-wrap">
        <table className="tbl stack">
          {state.staff.length ? (
            <>
              <thead><tr><th>Personel</th><th>Bugünkü vardiya</th><th>Durum</th><th>Giriş</th><th>Süre</th><th /></tr></thead>
              <tbody>
                {state.staff.map((s) => (
                  <tr key={s.id}>
                    <td className="main"><div className="person"><span className={`avatar${s.onShift ? ' on' : ''}`}>{initials(s.name)}</span><b>{s.name}</b></div></td>
                    <td data-label="Vardiya">
                      {s.todayShift ? <>{s.todayShift.name} <span className="dim">{shiftTimes(s.todayShift)}</span></> : '—'}
                      {!s.onShift && !s.todayPlanned && <span className="dim block">Girişe göre otomatik</span>}
                    </td>
                    <td data-label="Durum">
                      {s.onShift
                        ? <><span className="pill on">Mesaide</span>{s.late > 0 && <> <span className="pill late">{s.late} dk geç</span></>}</>
                        : s.onLeave ? <span className="pill leave">İzinli</span> : <span className="pill off">Dışarıda</span>}
                    </td>
                    <td data-label="Giriş">{s.onShift ? tFmt(s.checkIn) : '—'}</td>
                    <td data-label="Süre">{s.onShift ? durFmt(minsBetween(s.checkIn)) : '—'}</td>
                    <td className="act">
                      {s.onShift
                        ? <button className="btn primary sm" onClick={() => openCheckout(s.openRecordId, s.name, s.checkIn)}>Çıkış yap</button>
                        : <button className="btn sm" onClick={() => manual(s)}>Manuel giriş</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <tbody><tr><td className="empty">Henüz personel yok. &quot;Personel&quot; sekmesinden ekleyin.</td></tr></tbody>
          )}
        </table>
      </div>

      <h2>Bugünkü hareketler</h2>
      <div className="table-wrap"><RecordTable records={state.today} empty="Bugün henüz hareket yok." showDate={false} /></div>
    </>
  );
}

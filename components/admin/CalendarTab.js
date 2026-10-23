'use client';

import { useCallback, useEffect, useState } from 'react';
import { DAY_SHORT, dayFmt, durFmt, hrsFmt, initials, money, monthStart, MONTHS, shiftLabel, tFmt } from '@/lib/format';
import { useAdmin } from './context';
import Dialog from './Dialog';
import Stats from './Stats';

const STATUS_TXT = {
  ok: 'Zamanında geldi', late: 'Geç geldi', absent: 'Gelmedi', leave: 'İzinli', off: 'Haftalık izin günü',
  open: 'Şu an mesaide', pending: 'Henüz gelmedi', future: 'İleri tarih', before: 'İşe başlamadan önce',
  part: 'Part time çalıştı', free: 'Part time, gelmedi (eksik sayılmaz)',
};
// Part time günlerde saat yazılır (ör. 4,5)
const cellText = (d) => (d.status === 'part' ? hrsFmt(d.minutes || 0) : d.status === 'ok' ? '✓' : d.status === 'late' ? d.late
  : d.status === 'absent' ? '✕' : d.status === 'leave' ? 'İ' : '');

function DayDialog({ staff, day, today, onClose, onChanged }) {
  const { api, state, toast, openRecord } = useAdmin();
  const d = day;
  const rows = [
    ['Durum', <><span className={`c ${d.status} inline`} /> {STATUS_TXT[d.status]}{d.status === 'late' && <>, <b>{d.late} dk</b></>}</>],
    ['Vardiya', <>{d.shift ? shiftLabel(d.shift) : '—'}{d.shiftOverride && !d.checkIn && <> <span className="pill">Bu güne özel</span></>}
      {!d.checkIn && !d.planned && (staff.shiftIds?.length || 0) > 1 && <span className="dim block">Planlanmadı: girişte en yakın vardiya seçilir</span>}</>],
  ];
  if (d.checkIn) {
    rows.push(
      ['Giriş', <>{tFmt(d.checkIn)}{d.manual && <> <span className="pill">Manuel</span></>}{d.edited && <> <span className="pill">Düzenlendi</span></>}</>],
      ['Çıkış', d.checkOut ? tFmt(d.checkOut) : '—'],
      ['Süre', durFmt(d.minutes)],
      ['Hakediş', <b>{money(d.earning)}</b>],
    );
    if (d.records > 1) rows.push(['Not', `Bu gün ${d.records} kayıt var (toplam gösteriliyor)`]);
  }

  const setShift = async (e) => {
    try { await api('admin_set_day_shift', { p_staff: staff.id, p_day: d.day, p_shift: e.target.value ? Number(e.target.value) : null }); toast('Vardiya değiştirildi'); onChanged(); }
    catch (err) { toast(err.message, false); }
  };
  const toggleLeave = async () => {
    try { const on = await api('admin_toggle_leave', { p_staff: staff.id, p_day: d.day }); toast(on ? 'İzin verildi' : 'İzin kaldırıldı'); onChanged(); }
    catch (err) { toast(err.message, false); }
  };
  const record = async () => {
    try {
      if (d.checkIn) {
        const list = await api('admin_records', { p_from: d.day, p_to: d.day, p_staff: staff.id });
        onClose();
        openRecord(list.find((r) => r.id === d.recordId) || list[0]);
      } else {
        onClose();
        openRecord(null, { staffId: staff.id, day: d.day, shift: d.shift });
      }
    } catch (err) { toast(err.message, false); }
  };

  return (
    <Dialog open onClose={onClose}>
      <h3>{staff.name}</h3>
      <p>{dayFmt(d.day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div className="day-info">
        {rows.map(([k, v]) => <div key={k}><span>{k}</span><span>{v}</span></div>)}
      </div>
      {!d.checkIn && (
        <label className="day-shift">Bu günün vardiyası
          <select value={d.shiftOverride ? d.shift?.id ?? '' : ''} onChange={setShift}>
            <option value="">Haftalık plana göre</option>
            {state.shifts.map((x) => <option key={x.id} value={x.id}>{shiftLabel(x)}</option>)}
          </select>
        </label>
      )}
      <div className="dlg-actions">
        {(!d.checkIn || d.leave) && <button type="button" className="btn" onClick={toggleLeave}>{d.leave ? 'İzni kaldır' : 'İzin ver'}</button>}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onClose}>Kapat</button>
        {(d.checkIn || d.day <= today) && <button type="button" className="btn primary" onClick={record}>{d.checkIn ? 'Kaydı düzenle' : 'Kayıt ekle'}</button>}
      </div>
    </Dialog>
  );
}

export default function CalendarTab({ active }) {
  const { api, state, version, toast } = useAdmin();
  const [month, setMonth] = useState(monthStart);
  const [cal, setCal] = useState(null);
  const [sel, setSel] = useState(null); // [staffIndex, dayIndex]

  const load = useCallback(async () => {
    try { setCal(await api('admin_calendar', { p_month: month })); }
    catch (err) { if (err.message !== 'Giriş gerekli') toast(err.message, false); }
  }, [api, month, toast]);
  useEffect(() => { if (active) load(); }, [active, load, version]);

  const shift = (n) => {
    const [y, m] = month.split('-').map(Number);
    setMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10));
  };
  const [y, m] = month.split('-').map(Number);
  const days = cal?.staff[0]?.days.map((d) => d.day) || [];

  let tLate = 0, tLateMin = 0, tAbsent = 0, tEarn = 0;
  const rows = (cal?.staff || []).map((s) => {
    const late = s.days.filter((d) => d.status === 'late');
    const absent = s.days.filter((d) => d.status === 'absent').length;
    const lateMin = late.reduce((a, d) => a + d.late, 0);
    const mins = s.days.reduce((a, d) => a + (d.minutes || 0), 0);
    const earn = s.days.reduce((a, d) => a + Number(d.earning || 0), 0);
    tLate += late.length; tLateMin += lateMin; tAbsent += absent; tEarn += earn;
    return { s, lateMin, absent, mins, earn, names: (s.shiftIds || []).map((id) => state.shifts.find((x) => x.id === id)?.name).filter(Boolean).join(', ') };
  });

  return (
    <>
      <div className="cal-head">
        <div>
          <h1 className="page-title">{MONTHS[m - 1]} {y}</h1>
          <p className="page-sub">Bir güne tıklayın: detay, vardiya değiştirme, kayıt düzenleme, izin.</p>
        </div>
        <div className="cal-nav">
          <button className="btn sm" aria-label="Önceki ay" onClick={() => shift(-1)}>‹</button>
          <button className="btn sm" onClick={() => setMonth(monthStart())}>Bu ay</button>
          <button className="btn sm" aria-label="Sonraki ay" onClick={() => shift(1)}>›</button>
        </div>
      </div>
      <div className="legend">
        <span><i className="c ok">✓</i>Zamanında</span>
        <span><i className="c late">12</i>Geç (dk)</span>
        <span><i className="c absent">✕</i>Gelmedi</span>
        <span><i className="c leave">İ</i>İzinli</span>
        <span><i className="c off" />Haftalık izin</span>
        <span><i className="c open" />Mesaide</span>
        <span><i className="c part">4,5</i>Part time (saat)</span>
        <span><i className="c future swap" />Vardiya değişikliği</span>
      </div>
      <Stats items={[
        { label: 'Geç giriş', value: tLate },
        { label: 'Toplam gecikme', value: tLateMin, unit: 'dk' },
        { label: 'Gelinmeyen gün', value: tAbsent },
        { label: 'Aylık hakediş', value: money(tEarn), money: true, accent: true },
      ]} />
      <div className="table-wrap cal-wrap">
        <table className="cal">
          {rows.length ? (
            <>
              <thead>
                <tr>
                  <th className="who">Personel</th>
                  {days.map((d) => {
                    const dt = new Date(d + 'T12:00:00Z'), dow = (dt.getUTCDay() + 6) % 7;
                    return <th key={d} className={`${d === cal.today ? 'today' : ''} ${dow >= 5 ? 'we' : ''}`}><small>{DAY_SHORT[dow]}</small>{dt.getUTCDate()}</th>;
                  })}
                  <th className="sum">Geç dk</th><th className="sum">Gelmedi</th><th className="sum">Saat</th><th className="sum">Hakediş</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, lateMin, absent, mins, earn, names }, si) => (
                  <tr key={s.id}>
                    <td className="who">
                      <div className="person"><span className="avatar">{initials(s.name)}</span>
                        <div><b>{s.name}</b><span className="dim">{names || 'Vardiya yok'}</span></div>
                      </div>
                    </td>
                    {s.days.map((d, di) => (
                      <td key={d.day} className={d.day === cal.today ? 'today' : ''}>
                        <button className={`c ${d.status}${d.shiftOverride ? ' swap' : ''}`} onClick={() => setSel([si, di])}
                          title={`${STATUS_TXT[d.status]}${d.shift ? ', ' + shiftLabel(d.shift) : ''}`}>{cellText(d)}</button>
                      </td>
                    ))}
                    <td className={`sum${lateMin ? ' warn' : ''}`}>{lateMin || '–'}</td>
                    <td className={`sum${absent ? ' bad' : ''}`}>{absent || '–'}</td>
                    <td className="sum">{mins ? hrsFmt(mins) : '–'}</td>
                    <td className="sum money">{earn ? money(earn) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : <tbody><tr><td className="empty">{cal ? 'Henüz personel yok.' : 'Yükleniyor…'}</td></tr></tbody>}
        </table>
      </div>
      {sel && cal && (
        <DayDialog staff={cal.staff[sel[0]]} day={cal.staff[sel[0]].days[sel[1]]} today={cal.today}
          onClose={() => setSel(null)} onChanged={load} />
      )}
    </>
  );
}

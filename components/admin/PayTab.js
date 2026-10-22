'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { dayFmt, downloadCsv, durFmt, hrsFmt, initials, money, monthStart, num, tFmt, todayStr } from '@/lib/format';
import { useAdmin } from './context';
import Stats from './Stats';

// Kayıtları personel > gün olarak grupla
function group(recs) {
  const by = new Map();
  for (const r of recs) {
    if (!by.has(r.staffId)) by.set(r.staffId, { id: r.staffId, name: r.staffName, days: new Map(), minutes: 0, earning: 0, late: 0 });
    const p = by.get(r.staffId);
    if (!p.days.has(r.day)) p.days.set(r.day, { day: r.day, records: [], minutes: 0, earning: 0, late: 0 });
    const d = p.days.get(r.day);
    d.records.push(r); d.minutes += r.minutes; d.earning += Number(r.earning); d.late += r.late;
    p.minutes += r.minutes; p.earning += Number(r.earning); p.late += r.late;
  }
  return [...by.values()]
    .map((p) => ({ ...p, days: [...p.days.values()].sort((a, b) => a.day.localeCompare(b.day)) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

export default function PayTab({ active }) {
  const { api, state, version, toast, openRecord } = useAdmin();
  const [filter, setFilter] = useState(() => ({ from: monthStart(), to: todayStr(), staff: '' }));
  const [recs, setRecs] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const set = (k) => (e) => setFilter((f) => ({ ...f, [k]: e.target.value }));

  const load = useCallback(async () => {
    try {
      const list = await api('admin_records', { p_from: filter.from, p_to: filter.to, p_staff: filter.staff ? Number(filter.staff) : null });
      setRecs(list); return list;
    } catch (err) { if (err.message !== 'Giriş gerekli') toast(err.message, false); return []; }
  }, [api, filter, toast]);
  useEffect(() => { if (active) load(); }, [active, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => group(recs || []), [recs]);
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const csv = async () => {
    const g = group(await load());
    const rows = [['Personel', 'Tarih', 'Giriş', 'Çıkış', 'Süre (dk)', 'Geç (dk)', 'Saatlik ücret', 'Hakediş']];
    for (const p of g) {
      for (const d of p.days) for (const r of d.records) rows.push([p.name, d.day, tFmt(r.checkIn), r.checkOut ? tFmt(r.checkOut) : '', r.minutes, r.late, num(r.hourlyRate), num(r.earning)]);
      rows.push([p.name + ' TOPLAM', '', '', '', p.minutes, p.late, '', num(p.earning)]);
    }
    downloadCsv(`hakedis-${filter.from}-${filter.to}.csv`, rows);
  };

  return (
    <>
      <h1 className="page-title">Hakediş</h1>
      <p className="page-sub">Çalışılan süre × saatlik ücret. Her kayıt, girildiği andaki ücretle hesaplanır. Satıra tıklayarak günlük dökümü açın.</p>
      <form className="card row-form" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <label>Başlangıç<input type="date" value={filter.from} onChange={set('from')} required /></label>
        <label>Bitiş<input type="date" value={filter.to} onChange={set('to')} required /></label>
        <label>Personel
          <select value={filter.staff} onChange={set('staff')}>
            <option value="">Tümü</option>
            {state.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <button className="btn primary">Hesapla</button>
        <button type="button" className="btn" onClick={csv}>Excel (CSV)</button>
      </form>
      <Stats items={[
        { label: 'Personel', value: data.length },
        { label: 'Çalışılan gün', value: data.reduce((a, p) => a + p.days.length, 0) },
        { label: 'Toplam süre', value: hrsFmt(data.reduce((a, p) => a + p.minutes, 0)), unit: 'sa' },
        { label: 'Toplam hakediş', value: money(data.reduce((a, p) => a + p.earning, 0)), money: true, accent: true },
      ]} />
      <div className="table-wrap">
        <table className="tbl pay">
          {data.length ? (
            <>
              <thead><tr><th>Personel</th><th>Gün</th><th>Süre</th><th>Gecikme</th><th>Güncel ücret</th><th className="r">Hakediş</th><th /></tr></thead>
              {data.map((p) => {
                const cur = state.staff.find((s) => s.id === p.id);
                return (
                  <tbody key={p.id} className="pay-group" data-open={open.has(p.id) ? '1' : '0'}>
                    <tr className="pay-row" onClick={() => toggle(p.id)}>
                      <td><div className="person"><span className="avatar">{initials(p.name)}</span><b>{p.name}</b></div></td>
                      <td>{p.days.length}</td>
                      <td>{durFmt(p.minutes)}</td>
                      <td>{p.late ? <span className="pill late">{p.late} dk</span> : '—'}</td>
                      <td>{cur ? `${money(cur.hourlyRate)}/sa` : '—'}</td>
                      <td className="r"><b className="money big">{money(p.earning)}</b></td>
                      <td className="act"><span className="chev">›</span></td>
                    </tr>
                    {p.days.map((d) => (
                      <tr key={d.day} className="pay-day">
                        <td>{dayFmt(d.day)}</td>
                        <td colSpan={2}>
                          {d.records.map((r) => `${tFmt(r.checkIn)}–${r.checkOut ? tFmt(r.checkOut) : '…'}`).join(', ')}
                          <span className="dim">, toplam {durFmt(d.minutes)}</span>
                        </td>
                        <td>{d.late > 0 && <span className="pill late">{d.late} dk</span>}</td>
                        <td>{[...new Set(d.records.map((r) => money(r.hourlyRate)))].join(', ')}/sa</td>
                        <td className="r"><b>{money(d.earning)}</b></td>
                        <td className="act">
                          {d.records.map((r) => <button key={r.id} className="btn ghost sm" onClick={() => openRecord(r)}>Düzenle</button>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                );
              })}
            </>
          ) : <tbody><tr><td className="empty">{recs ? 'Bu aralıkta çalışma kaydı yok.' : 'Yükleniyor…'}</td></tr></tbody>}
        </table>
      </div>
    </>
  );
}

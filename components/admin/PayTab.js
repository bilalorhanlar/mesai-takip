'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { dayFmt, downloadCsv, durFmt, hrsFmt, initials, money, MONTHS, num, payText, tFmt, todayStr } from '@/lib/format';
import { useAdmin } from './context';
import Stats from './Stats';

const monthRange = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`];
};

// Personel bazında ay özeti. Maaşlıda hakediş = aylık maaş (+ maaşlıya geçmeden önceki saatlik kayıtlar).
function summarize(staffList, recs) {
  const by = new Map(staffList.map((s) => [s.id, { staff: s, id: s.id, name: s.name, days: new Map(), minutes: 0, earning: 0, late: 0 }]));
  for (const r of recs) {
    if (!by.has(r.staffId)) by.set(r.staffId, { staff: null, id: r.staffId, name: r.staffName, days: new Map(), minutes: 0, earning: 0, late: 0 });
    const p = by.get(r.staffId);
    if (!p.days.has(r.day)) p.days.set(r.day, { day: r.day, records: [], minutes: 0, earning: 0, late: 0 });
    const d = p.days.get(r.day);
    d.records.push(r); d.minutes += r.minutes; d.earning += Number(r.earning); d.late += r.late;
    p.minutes += r.minutes; p.earning += Number(r.earning); p.late += r.late;
  }
  return [...by.values()].map((p) => {
    const salary = p.staff?.payType === 'salary' ? Number(p.staff.monthlySalary || 0) : 0;
    const target = p.staff?.monthlyHours != null ? Number(p.staff.monthlyHours) * 60 : null;
    return {
      ...p, salary, target, total: p.earning + salary,
      missing: target != null ? Math.max(0, target - p.minutes) : null,
      days: [...p.days.values()].sort((a, b) => a.day.localeCompare(b.day)),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

function Progress({ minutes, target }) {
  if (target == null) return <span className="dim">Hedef yok</span>;
  const pct = target ? Math.min(100, Math.round((minutes / target) * 100)) : 100;
  return (
    <div className="progress" title={`%${pct}`}>
      <span className="progress-text">{hrsFmt(minutes)} / {hrsFmt(target)} sa</span>
      <span className="progress-bar"><i style={{ width: `${pct}%` }} className={pct >= 100 ? 'full' : ''} /></span>
    </div>
  );
}

export default function PayTab({ active }) {
  const { api, state, version, toast, openRecord } = useAdmin();
  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [staffFilter, setStaffFilter] = useState('');
  const [recs, setRecs] = useState(null);
  const [open, setOpen] = useState(() => new Set());

  const load = useCallback(async () => {
    const [from, to] = monthRange(month);
    try {
      const list = await api('admin_records', { p_from: from, p_to: to, p_staff: staffFilter ? Number(staffFilter) : null });
      setRecs(list); return list;
    } catch (err) { if (err.message !== 'Giriş gerekli') toast(err.message, false); return []; }
  }, [api, month, staffFilter, toast]);
  useEffect(() => { if (active) load(); }, [active, version, load]);

  const staffList = useMemo(() => state.staff.filter((s) => !staffFilter || s.id === Number(staffFilter)), [state.staff, staffFilter]);
  const data = useMemo(() => summarize(staffList, recs || []), [staffList, recs]);
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [y, m] = month.split('-').map(Number);

  const csv = async () => {
    const g = summarize(staffList, await load());
    const rows = [['Personel', 'Ücret', 'Tarih', 'Giriş', 'Çıkış', 'Süre (dk)', 'Geç (dk)', 'Saatlik ücret', 'Hakediş']];
    for (const p of g) {
      for (const d of p.days) for (const r of d.records) rows.push([p.name, '', d.day, tFmt(r.checkIn), r.checkOut ? tFmt(r.checkOut) : '', r.minutes, r.late, num(r.hourlyRate), num(r.earning)]);
      if (p.salary) rows.push([p.name, 'Aylık maaş', '', '', '', '', '', '', num(p.salary)]);
      rows.push([`${p.name} TOPLAM`, p.staff ? payText(p.staff) : '', '', '', '',
        p.minutes + (p.target != null ? ` / hedef ${p.target}` : ''), p.late, '', num(p.total)]);
    }
    downloadCsv(`hakedis-${month}.csv`, rows);
  };

  return (
    <>
      <h1 className="page-title">Hakediş</h1>
      <p className="page-sub">
        Saatlik çalışanlarda çalışılan süre × saatlik ücret, maaşlılarda aylık maaş. Aylık hedef saati girilenlerde
        doldurulan ve eksik kalan saat görünür. Satıra tıklayarak günlük dökümü açın.
      </p>
      <form className="card row-form" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <label className="narrow wide-narrow">Ay<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required /></label>
        <label>Personel
          <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
            <option value="">Tümü</option>
            {state.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <button type="button" className="btn" onClick={csv}>Excel (CSV)</button>
      </form>
      <Stats items={[
        { label: `${MONTHS[m - 1]} ${y}, çalışan`, value: data.filter((p) => p.minutes).length },
        { label: 'Toplam süre', value: hrsFmt(data.reduce((a, p) => a + p.minutes, 0)), unit: 'sa' },
        { label: 'Eksik saat (hedefe göre)', value: hrsFmt(data.reduce((a, p) => a + (p.missing || 0), 0)), unit: 'sa' },
        { label: 'Toplam hakediş', value: money(data.reduce((a, p) => a + p.total, 0)), money: true, accent: true },
      ]} />
      <div className="table-wrap">
        <table className="tbl pay stack lg">
          {data.length ? (
            <>
              <thead><tr><th>Personel</th><th>Ücret</th><th>Gün</th><th>Saat / hedef</th><th>Eksik</th><th>Gecikme</th><th className="r">Hakediş</th><th /></tr></thead>
              {data.map((p) => (
                <tbody key={p.id} className="pay-group" data-open={open.has(p.id) ? '1' : '0'}>
                  <tr className="pay-row" onClick={() => p.days.length && toggle(p.id)}>
                    <td className="main"><div className="person"><span className="avatar">{initials(p.name)}</span><b>{p.name}</b></div></td>
                    <td data-label="Ücret">{p.staff ? payText(p.staff) : '—'}</td>
                    <td data-label="Gün">{p.days.length}</td>
                    <td data-label="Saat / hedef"><Progress minutes={p.minutes} target={p.target} /></td>
                    <td data-label="Eksik">{p.missing ? <span className="pill late">{hrsFmt(p.missing)} sa</span> : p.target != null ? <span className="pill on-soft">Tamam</span> : '—'}</td>
                    <td data-label="Gecikme">{p.late ? <span className="pill late">{p.late} dk</span> : '—'}</td>
                    <td className="r" data-label="Hakediş">
                      {p.staff?.payType === 'salary' && p.staff.monthlySalary == null && !p.earning
                        ? <span className="dim">Maaş girilmedi</span>
                        : <b className="money big">{money(p.total)}</b>}
                    </td>
                    <td className="act">{p.days.length > 0 && <span className="chev">›</span>}</td>
                  </tr>
                  {p.days.map((d) => (
                    <tr key={d.day} className="pay-day">
                      <td className="main">{dayFmt(d.day)}</td>
                      <td colSpan={3} data-label="Saatler">
                        {d.records.map((r) => `${tFmt(r.checkIn)}–${r.checkOut ? tFmt(r.checkOut) : '…'}`).join(', ')}
                        <span className="dim">, toplam {durFmt(d.minutes)}</span>
                      </td>
                      <td className="pay-gap" />
                      <td data-label="Gecikme">{d.late > 0 && <span className="pill late">{d.late} dk</span>}</td>
                      <td className="r" data-label="Hakediş">{d.earning ? <b>{money(d.earning)}</b> : <span className="dim">—</span>}</td>
                      <td className="act">
                        {d.records.map((r) => <button key={r.id} className="btn ghost sm" onClick={() => openRecord(r)}>Düzenle</button>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </>
          ) : <tbody><tr><td className="empty">{recs ? 'Personel yok.' : 'Yükleniyor…'}</td></tr></tbody>}
        </table>
      </div>
    </>
  );
}

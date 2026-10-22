'use client';

import { useCallback, useEffect, useState } from 'react';
import { daysAgoStr, downloadCsv, hrsFmt, money, num, TZ, todayStr } from '@/lib/format';
import { useAdmin } from './context';
import RecordTable from './RecordTable';
import Stats from './Stats';

export default function RecordsTab({ active }) {
  const { api, state, version, toast, openRecord } = useAdmin();
  const [filter, setFilter] = useState(() => ({ from: daysAgoStr(6), to: todayStr(), staff: '' }));
  const [records, setRecords] = useState(null);
  const set = (k) => (e) => setFilter((f) => ({ ...f, [k]: e.target.value }));

  const load = useCallback(async (f = filter) => {
    try {
      const list = await api('admin_records', { p_from: f.from || null, p_to: f.to || null, p_staff: f.staff ? Number(f.staff) : null });
      setRecords(list); return list;
    } catch (err) { if (err.message !== 'Giriş gerekli') toast(err.message, false); return []; }
  }, [api, filter, toast]);
  // Filtre değişince değil, "Listele"ye basınca ya da veri değişince yükle
  useEffect(() => { if (active) load(); }, [active, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const csv = async () => {
    const list = await load();
    const full = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { timeZone: TZ }) : '');
    const rows = [['Personel', 'Giriş', 'Çıkış', 'Süre (dk)', 'Vardiya', 'Geç (dk)', 'Saatlik ücret', 'Hakediş', 'Manuel', 'Düzenlendi']];
    for (const r of list) rows.push([r.staffName, full(r.checkIn), full(r.checkOut), r.minutes, r.shiftName ? `${r.shiftName} ${r.shiftStart}-${r.shiftEnd}` : '', r.late, num(r.hourlyRate), num(r.earning), r.manual ? 'Evet' : '', r.edited ? 'Evet' : '']);
    downloadCsv(`mesai-${filter.from}-${filter.to}.csv`, rows);
  };

  const list = records || [];
  const total = list.reduce((a, r) => a + r.minutes, 0);
  const late = list.filter((r) => r.late > 0);

  return (
    <>
      <h1 className="page-title">Kayıtlar</h1>
      <p className="page-sub">Giriş-çıkış geçmişi. Her kaydın saatini, vardiyasını ve ücretini düzenleyebilir, unutulan günleri ekleyebilirsiniz.</p>
      <form className="card row-form" onSubmit={(e) => { e.preventDefault(); load(); }}>
        <label>Başlangıç<input type="date" value={filter.from} onChange={set('from')} /></label>
        <label>Bitiş<input type="date" value={filter.to} onChange={set('to')} /></label>
        <label>Personel
          <select value={filter.staff} onChange={set('staff')}>
            <option value="">Tümü</option>
            {state.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <button className="btn primary">Listele</button>
        <button type="button" className="btn" onClick={() => openRecord(null, { staffId: filter.staff ? Number(filter.staff) : undefined })}>+ Kayıt ekle</button>
        <button type="button" className="btn" onClick={csv}>Excel (CSV)</button>
      </form>
      <Stats items={[
        { label: 'Kayıt', value: list.length },
        { label: 'Toplam çalışma', value: hrsFmt(total), unit: 'sa' },
        { label: `Toplam gecikme (${late.length} kez)`, value: late.reduce((a, r) => a + r.late, 0), unit: 'dk' },
        { label: 'Toplam hakediş', value: money(list.reduce((a, r) => a + Number(r.earning), 0)), money: true, accent: true },
      ]} />
      <div className="table-wrap"><RecordTable records={list} empty={records ? 'Bu aralıkta kayıt yok.' : 'Yükleniyor…'} /></div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { durFmt } from '@/lib/format';
import { useAdmin } from './context';

const toMin = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

function ShiftRow({ x }) {
  const { api, toast, afterChange } = useAdmin();
  const [f, setF] = useState({ name: x.name, start: x.start, end: x.end });
  useEffect(() => setF({ name: x.name, start: x.start, end: x.end }), [x]);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  let m = toMin(f.end) - toMin(f.start); if (m <= 0) m += 1440;

  const save = async () => {
    try { await api('admin_save_shift', { p_id: x.id, p_name: f.name, p_start: f.start, p_end: f.end }); toast('Vardiya kaydedildi'); afterChange(); }
    catch (err) { toast(err.message, false); }
  };
  const remove = async () => {
    if (!confirm(`"${x.name}" vardiyası silinsin mi? Geçmiş kayıtlar etkilenmez.`)) return;
    try { await api('admin_delete_shift', { p_id: x.id }); toast('Vardiya silindi'); afterChange(); }
    catch (err) { toast(err.message, false); }
  };

  return (
    <tr>
      <td><input value={f.name} onChange={set('name')} /></td>
      <td><input type="time" value={f.start} onChange={set('start')} /></td>
      <td><input type="time" value={f.end} onChange={set('end')} /></td>
      <td>{durFmt(m)}{f.end <= f.start && <> <span className="pill">Ertesi gün biter</span></>}</td>
      <td>{x.staffCount ? <span className="pill on-soft">{x.staffCount} kişi</span> : <span className="dim">—</span>}</td>
      <td className="act">
        <button className="btn primary sm" onClick={save}>Kaydet</button>
        <button className="btn ghost sm danger" onClick={remove}>Sil</button>
      </td>
    </tr>
  );
}

export default function ShiftsTab() {
  const { api, state, toast, afterChange } = useAdmin();
  const [f, setF] = useState({ name: '', start: '09:00', end: '18:00' });
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const add = async (e) => {
    e.preventDefault();
    try { await api('admin_save_shift', { p_id: null, p_name: f.name, p_start: f.start, p_end: f.end }); setF((v) => ({ ...v, name: '' })); toast('Vardiya eklendi'); afterChange(); }
    catch (err) { toast(err.message, false); }
  };

  return (
    <>
      <h1 className="page-title">Vardiyalar</h1>
      <p className="page-sub">İstediğiniz kadar vardiya tanımlayın. Personele varsayılan vardiya atanır; belirli bir gün için Takvim&apos;den değiştirebilirsiniz. Saat değişiklikleri geçmiş kayıtları etkilemez.</p>
      <h2>Yeni vardiya</h2>
      <form className="card row-form" onSubmit={add}>
        <label>Vardiya adı<input value={f.name} onChange={set('name')} required placeholder="Örn. Akşam" /></label>
        <label className="narrow">Başlangıç<input type="time" value={f.start} onChange={set('start')} required /></label>
        <label className="narrow">Bitiş<input type="time" value={f.end} onChange={set('end')} required /></label>
        <button className="btn primary">Vardiya ekle</button>
      </form>
      <h2>Tanımlı vardiyalar</h2>
      <div className="table-wrap">
        <table className="tbl">
          {state.shifts.length ? (
            <>
              <thead><tr><th>Vardiya adı</th><th>Başlangıç</th><th>Bitiş</th><th>Süre</th><th>Personel</th><th /></tr></thead>
              <tbody>{state.shifts.map((x) => <ShiftRow key={x.id} x={x} />)}</tbody>
            </>
          ) : <tbody><tr><td className="empty">Henüz vardiya yok.</td></tr></tbody>}
        </table>
      </div>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { shiftLabel } from '@/lib/format';
import { useAdmin } from './context';
import DaysPicker from './DaysPicker';

function StaffRow({ s }) {
  const { api, state, toast, afterChange } = useAdmin();
  const fromProps = () => ({ name: s.name, code: s.code || '', shift: s.shiftId ?? '', rate: String(s.hourlyRate), days: s.offDays || [] });
  const [f, setF] = useState(fromProps);
  useEffect(() => setF(fromProps()), [s]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    try {
      const code = f.code.trim();
      if (code !== (s.code || '')) {
        if (!confirm(`Kod ${code} olarak değiştirilsin mi? Personelin telefonunda yeni kodu girmesi gerekir.`)) return;
        await api('admin_set_code', { p_id: s.id, p_code: code });
      }
      await api('admin_update_staff', { p_id: s.id, p_name: f.name, p_shift: Number(f.shift), p_hourly_rate: Number(f.rate), p_off_days: f.days });
      toast('Kaydedildi'); afterChange();
    } catch (err) { toast(err.message, false); }
  };
  const randomCode = async () => {
    if (!confirm(`${s.name} için rastgele yeni kod oluşturulsun mu? Personelin telefonunda yeniden kod girmesi gerekir.`)) return;
    try { const ns = await api('admin_set_code', { p_id: s.id, p_code: null }); toast(`Yeni kod: ${ns.code}`); afterChange(); }
    catch (err) { toast(err.message, false); }
  };
  const remove = async () => {
    if (!confirm(`${s.name} silinsin mi? Geçmiş kayıtları korunur.`)) return;
    try { await api('admin_delete_staff', { p_id: s.id }); toast('Personel silindi'); afterChange(); }
    catch (err) { toast(err.message, false); }
  };

  return (
    <tr>
      <td><input value={f.name} onChange={set('name')} /></td>
      <td>
        <div className="code-cell">
          <input className="code-input" value={f.code} onChange={set('code')} inputMode="numeric" maxLength={4} />
          <button className="btn ghost sm" title="Rastgele kod" onClick={randomCode}>↻</button>
        </div>
      </td>
      <td>
        <select value={f.shift} onChange={set('shift')}>
          {!s.shiftId && <option value="">Seçin</option>}
          {state.shifts.map((x) => <option key={x.id} value={x.id}>{shiftLabel(x)}</option>)}
        </select>
      </td>
      <td><input type="number" min="0" step="0.01" className="rate-input" value={f.rate} onChange={set('rate')} /></td>
      <td><DaysPicker value={f.days} onChange={(days) => setF((x) => ({ ...x, days }))} /></td>
      <td className="act">
        <button className="btn primary sm" onClick={save}>Kaydet</button>
        <button className="btn ghost sm danger" onClick={remove}>Sil</button>
      </td>
    </tr>
  );
}

export default function StaffTab() {
  const { api, state, toast, afterChange } = useAdmin();
  const empty = { name: '', code: '', shift: '', rate: '0', days: [] };
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const shiftId = f.shift || state.shifts[0]?.id || '';

  const add = async (e) => {
    e.preventDefault();
    try {
      const s = await api('admin_add_staff', {
        p_name: f.name, p_code: f.code.trim() || null, p_shift: Number(shiftId), p_hourly_rate: Number(f.rate), p_off_days: f.days,
      });
      setMsg({ text: `${s.name} eklendi — giriş kodu: ${s.code}`, ok: true });
      toast(`${s.name} eklendi`);
      setF({ ...empty, shift: f.shift, rate: f.rate });
      afterChange();
    } catch (err) { setMsg({ text: err.message, ok: false }); }
  };

  return (
    <>
      <h1 className="page-title">Personel</h1>
      <p className="page-sub">Giriş kodunu kendiniz belirleyebilir ya da boş bırakıp otomatik oluşturabilirsiniz. Personel kodu telefonunda bir kez girer.</p>
      <h2>Yeni personel</h2>
      <form className="card row-form" onSubmit={add}>
        <label>Ad Soyad<input value={f.name} onChange={set('name')} required placeholder="Örn. Ahmet Yılmaz" /></label>
        <label className="narrow">Giriş kodu
          <input value={f.code} onChange={set('code')} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="Otomatik" className="code-input" />
        </label>
        <label>Vardiya
          <select value={shiftId} onChange={set('shift')} required>
            {state.shifts.map((x) => <option key={x.id} value={x.id}>{shiftLabel(x)}</option>)}
          </select>
        </label>
        <label className="narrow">Saatlik ücret (₺)<input type="number" min="0" step="0.01" value={f.rate} onChange={set('rate')} required /></label>
        <div className="field"><span>Haftalık izin günleri</span><DaysPicker value={f.days} onChange={(days) => setF((x) => ({ ...x, days }))} /></div>
        <button className="btn primary">Ekle</button>
      </form>
      {msg && <p className={`msg ${msg.ok ? 'ok big' : 'err'}`}>{msg.text}</p>}

      <h2>Personel listesi</h2>
      <div className="table-wrap">
        <table className="tbl">
          {state.staff.length ? (
            <>
              <thead><tr><th>Ad Soyad</th><th>Giriş kodu</th><th>Varsayılan vardiya</th><th>Ücret ₺/sa</th><th>İzin günleri</th><th /></tr></thead>
              <tbody>{state.staff.map((s) => <StaffRow key={s.id} s={s} />)}</tbody>
            </>
          ) : <tbody><tr><td className="empty">Henüz personel yok.</td></tr></tbody>}
        </table>
      </div>
    </>
  );
}

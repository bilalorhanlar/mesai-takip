'use client';

import { useState } from 'react';
import { dFmt, durFmt, fromLocalInput, minsBetween, money, nextDay, shiftLabel, todayStr, toLocalInput } from '@/lib/format';
import { useAdmin } from './context';
import Dialog from './Dialog';

// Kayıt ekle (rec yok) veya düzenle. Vardiya boşsa: düzenlemede kayıttaki vardiya korunur,
// eklemede o günün vardiyası kullanılır. Ücret boşsa personelin ücreti.
export default function RecordDialog({ rec, preset = {}, onClose }) {
  const { api, state, toast, afterChange } = useAdmin();
  const [form, setForm] = useState(() => {
    if (rec) {
      return {
        staff: rec.staffId, in: toLocalInput(new Date(rec.checkIn)), out: rec.checkOut ? toLocalInput(new Date(rec.checkOut)) : '',
        shift: '', rate: String(rec.hourlyRate),
      };
    }
    const staffId = preset.staffId || state.staff[0]?.id || '';
    const day = preset.day || todayStr();
    const sh = preset.shift || state.shifts.find((x) => x.id === state.staff.find((s) => s.id === Number(staffId))?.shiftId);
    return {
      staff: staffId,
      in: `${day}T${sh?.start || '09:00'}`,
      out: sh ? `${sh.end <= sh.start ? nextDay(day) : day}T${sh.end}` : `${day}T18:00`,
      shift: '', rate: '',
    };
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const staff = state.staff.find((s) => s.id === Number(form.staff));
  const rate = form.rate !== '' ? Number(form.rate) : Number(staff?.hourlyRate || 0);
  const mins = form.in ? minsBetween(fromLocalInput(form.in), form.out ? fromLocalInput(form.out) : null) : null;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('admin_save_record', {
        p_id: rec?.id || null, p_staff: rec ? null : Number(form.staff),
        p_check_in: fromLocalInput(form.in), p_check_out: fromLocalInput(form.out),
        p_shift: form.shift ? Number(form.shift) : null, p_hourly_rate: form.rate === '' ? null : Number(form.rate),
      });
      toast(rec ? 'Kayıt güncellendi' : 'Kayıt eklendi'); onClose(); afterChange();
    } catch (e2) { setErr(e2.message); }
  };

  const remove = async () => {
    if (!confirm('Bu kayıt kalıcı olarak silinsin mi?')) return;
    try { await api('admin_delete_record', { p_id: rec.id }); toast('Kayıt silindi'); onClose(); afterChange(); }
    catch (e2) { setErr(e2.message); }
  };

  return (
    <Dialog open onClose={onClose} className="wide">
      <form onSubmit={submit}>
        <h3>{rec ? 'Kaydı düzenle' : 'Kayıt ekle'}</h3>
        <p>{rec ? `${rec.staffName}, ${dFmt(rec.checkIn)}` : 'Unutulan bir giriş-çıkışı ekleyin.'}</p>
        <div className="dlg-grid">
          {!rec && (
            <label className="full">Personel
              <select value={form.staff} onChange={set('staff')}>
                {state.staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
          <label>Giriş<input type="datetime-local" value={form.in} onChange={set('in')} required /></label>
          <label>Çıkış<input type="datetime-local" value={form.out} onChange={set('out')} /><small>Boş: hâlâ mesaide</small></label>
          <label>Vardiya
            <select value={form.shift} onChange={set('shift')}>
              <option value="">{rec?.shiftName ? `Aynı kalsın (${rec.shiftName})` : 'O günün vardiyası'}</option>
              {state.shifts.map((x) => <option key={x.id} value={x.id}>{shiftLabel(x)}</option>)}
            </select>
          </label>
          <label>Saatlik ücret (₺)
            <input type="number" min="0" step="0.01" placeholder="Personelin ücreti" value={form.rate} onChange={set('rate')} />
          </label>
        </div>
        {mins != null && (
          <div className="preview"><span>{durFmt(mins)} × {money(rate)}/sa</span><b>{money((mins / 60) * rate)}</b></div>
        )}
        <p className="msg err">{err}</p>
        <div className="dlg-actions">
          {rec && <button type="button" className="btn ghost danger" onClick={remove}>Kaydı sil</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary">Kaydet</button>
        </div>
      </form>
    </Dialog>
  );
}

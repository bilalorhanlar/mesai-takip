'use client';

import { useState } from 'react';
import { DAY_SHORT, shiftTimes } from '@/lib/format';
import { useAdmin } from './context';
import Dialog from './Dialog';

const DAY_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

// Personel ekle / düzenle: ad, kod, ücret, çalışabildiği vardiyalar ve haftalık plan.
// Planda her gün: "Otomatik" (giriş-çıkış saatine en yakın vardiya), belirli bir vardiya ya da izin.
export default function StaffDialog({ staff, onClose }) {
  const { api, state, toast, afterChange } = useAdmin();
  const [f, setF] = useState(() => ({
    name: staff?.name || '',
    code: staff?.code || '',
    rate: staff ? String(staff.hourlyRate) : '0',
    shifts: staff?.shiftIds?.length ? staff.shiftIds : state.shifts[0] ? [state.shifts[0].id] : [],
    // gün -> 'auto' | 'off' | vardiya id
    plan: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d,
      staff?.offDays?.includes(d) ? 'off' : staff?.weekPlan?.[d] ? String(staff.weekPlan[d]) : 'auto'])),
  }));
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

  const toggleShift = (id) => setF((v) => {
    const shifts = v.shifts.includes(id) ? v.shifts.filter((x) => x !== id) : [...v.shifts, id];
    // Listeden çıkarılan vardiya plandan da çıkar
    const plan = Object.fromEntries(Object.entries(v.plan).map(([d, p]) => [d, p === String(id) && !shifts.includes(id) ? 'auto' : p]));
    return { ...v, shifts, plan };
  });
  const chosen = state.shifts.filter((x) => f.shifts.includes(x.id));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.shifts.length) return setErr('En az bir vardiya seçin');
    const offDays = Object.entries(f.plan).filter(([, p]) => p === 'off').map(([d]) => Number(d));
    const weekPlan = Object.fromEntries(Object.entries(f.plan).filter(([, p]) => p !== 'off' && p !== 'auto').map(([d, p]) => [d, Number(p)]));
    const args = { p_name: f.name, p_shift_ids: f.shifts, p_hourly_rate: Number(f.rate), p_off_days: offDays, p_week_plan: weekPlan };
    try {
      if (staff) {
        const code = f.code.trim();
        if (code !== (staff.code || '')) {
          if (!confirm(`Kod ${code} olarak değiştirilsin mi? Personelin telefonunda yeni kodu girmesi gerekir.`)) return;
          await api('admin_set_code', { p_id: staff.id, p_code: code });
        }
        await api('admin_update_staff', { p_id: staff.id, ...args });
        toast('Kaydedildi');
      } else {
        const s = await api('admin_add_staff', { ...args, p_code: f.code.trim() || null });
        toast(`${s.name} eklendi, giriş kodu ${s.code}`);
      }
      onClose(); afterChange();
    } catch (e2) { setErr(e2.message); }
  };

  return (
    <Dialog open onClose={onClose} className="wide">
      <form onSubmit={submit}>
        <h3>{staff ? staff.name : 'Yeni personel'}</h3>
        <p>{staff ? 'Bilgileri, vardiyaları ve haftalık planı düzenleyin.' : 'Kodu boş bırakırsanız otomatik oluşturulur.'}</p>
        <div className="dlg-grid">
          <label className="full">Ad soyad<input value={f.name} onChange={set('name')} required placeholder="Örn. Ahmet Yılmaz" /></label>
          <label>Giriş kodu
            <input className="code-input" value={f.code} onChange={set('code')} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="Otomatik" />
          </label>
          <label>Saatlik ücret (₺)<input type="number" min="0" step="0.01" value={f.rate} onChange={set('rate')} required /></label>
        </div>

        <div className="dlg-block">
          <span className="dlg-label">Çalışabildiği vardiyalar</span>
          <div className="chips">
            {state.shifts.map((x) => (
              <label key={x.id} className="chip">
                <input type="checkbox" checked={f.shifts.includes(x.id)} onChange={() => toggleShift(x.id)} />
                <span>{x.name} <small>{shiftTimes(x)}</small></span>
              </label>
            ))}
          </div>
        </div>

        <div className="dlg-block">
          <span className="dlg-label">Haftalık plan</span>
          <small className="dlg-help">Otomatik: o gün giriş ve çıkış saatine en yakın vardiya seçilir.</small>
          <div className="week">
            {DAY_SHORT.map((_, i) => {
              const d = i + 1;
              return (
                <label key={d} className={`week-day${f.plan[d] === 'off' ? ' off' : ''}`}>
                  <span>{DAY_LONG[i]}</span>
                  <select value={f.plan[d]} onChange={(e) => setF((v) => ({ ...v, plan: { ...v.plan, [d]: e.target.value } }))}>
                    <option value="auto">{chosen.length > 1 ? 'Otomatik' : chosen[0]?.name || 'Otomatik'}</option>
                    {chosen.length > 1 && chosen.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    <option value="off">İzinli</option>
                  </select>
                </label>
              );
            })}
          </div>
        </div>

        <p className="msg err">{err}</p>
        <div className="dlg-actions">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary">{staff ? 'Kaydet' : 'Personeli ekle'}</button>
        </div>
      </form>
    </Dialog>
  );
}

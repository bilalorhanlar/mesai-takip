'use client';

import { useState } from 'react';
import { DAY_SHORT, payText } from '@/lib/format';
import { useAdmin } from './context';
import StaffDialog from './StaffDialog';

// Haftalık planın kısa özeti: "Pt Sabah, Pz izinli, diğer günler otomatik"
function planSummary(s, shifts) {
  const name = (id) => shifts.find((x) => x.id === id)?.name || '?';
  const parts = [];
  for (let d = 1; d <= 7; d++) {
    if (s.offDays?.includes(d)) parts.push(`${DAY_SHORT[d - 1]} izinli`);
    else if (s.weekPlan?.[d]) parts.push(`${DAY_SHORT[d - 1]} ${name(s.weekPlan[d])}`);
  }
  const rest = (s.shiftIds?.length || 0) > 1 ? 'diğer günler otomatik' : '';
  if (!parts.length) return rest ? 'Her gün otomatik' : `Her gün ${name(s.shiftIds?.[0])}`;
  return [...parts, rest].filter(Boolean).join(', ');
}

export default function StaffTab() {
  const { api, state, toast, afterChange } = useAdmin();
  const [dlg, setDlg] = useState(null); // { staff } | { staff: null }

  const randomCode = async (s) => {
    if (!confirm(`${s.name} için rastgele yeni kod oluşturulsun mu? Personelin telefonunda yeniden kod girmesi gerekir.`)) return;
    try { const ns = await api('admin_set_code', { p_id: s.id, p_code: null }); toast(`Yeni kod: ${ns.code}`); afterChange(); }
    catch (err) { toast(err.message, false); }
  };
  const remove = async (s) => {
    if (!confirm(`${s.name} silinsin mi? Geçmiş kayıtları korunur.`)) return;
    try { await api('admin_delete_staff', { p_id: s.id }); toast('Personel silindi'); afterChange(); }
    catch (err) { toast(err.message, false); }
  };

  return (
    <>
      <div className="cal-head">
        <div>
          <h1 className="page-title">Personel</h1>
          <p className="page-sub">Bir kişi birden fazla vardiyada çalışabilir. Gün gün vardiya belirleyebilir ya da en yakın vardiyanın otomatik seçilmesine bırakabilirsiniz.</p>
        </div>
        <button className="btn primary" onClick={() => setDlg({ staff: null })}>Personel ekle</button>
      </div>

      <div className="table-wrap list-gap">
        <table className="tbl">
          {state.staff.length ? (
            <>
              <thead><tr><th>Ad soyad</th><th>Giriş kodu</th><th>Vardiyalar</th><th>Haftalık plan</th><th>Ücret</th><th>Aylık hedef</th><th /></tr></thead>
              <tbody>
                {state.staff.map((s) => (
                  <tr key={s.id}>
                    <td><b className="strong">{s.name}</b></td>
                    <td>
                      <span className="code-text">{s.code}</span>
                      <button className="btn ghost sm" title="Rastgele kod" onClick={() => randomCode(s)}>↻</button>
                    </td>
                    <td className="wrap">
                      {(s.shiftIds || []).map((id) => state.shifts.find((x) => x.id === id)).filter(Boolean).map((x) => (
                        <span key={x.id} className={`pill${x.partTime ? ' leave' : ''}`}>{x.name}</span>
                      ))}
                    </td>
                    <td className="wrap dim">{planSummary(s, state.shifts)}</td>
                    <td>{payText(s)}</td>
                    <td>{s.monthlyHours != null ? `${s.monthlyHours} sa` : <span className="dim">—</span>}</td>
                    <td className="act">
                      <button className="btn sm" onClick={() => setDlg({ staff: s })}>Düzenle</button>
                      <button className="btn ghost sm danger" onClick={() => remove(s)}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : <tbody><tr><td className="empty">Henüz personel yok. &quot;Personel ekle&quot; ile başlayın.</td></tr></tbody>}
        </table>
      </div>
      {dlg && <StaffDialog staff={dlg.staff} onClose={() => setDlg(null)} />}
    </>
  );
}

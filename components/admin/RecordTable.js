'use client';

import { dFmt, durFmt, money, tFmt } from '@/lib/format';
import { useAdmin } from './context';

// Kayıt tablosu (Şu An ve Kayıtlar sekmesinde ortak). Yatay kaydırma yok:
// geniş ekranda sade sütunlar, dar ekranda her satır etiketli bir karta dönüşür (.stack).
export default function RecordTable({ records, empty, showDate = true }) {
  const { openRecord, openCheckout } = useAdmin();
  if (!records.length) return <table className="tbl"><tbody><tr><td className="empty">{empty}</td></tr></tbody></table>;
  return (
    <table className="tbl stack">
      <thead>
        <tr><th>Personel</th><th>Vardiya</th><th>Saat</th><th>Süre</th><th>Hakediş</th><th /></tr>
      </thead>
      <tbody>
        {records.map((r) => (
          <tr key={r.id}>
            <td className="main">
              <b className="strong">{r.staffName}</b>
              <span className="dim block">
                {showDate && dFmt(r.checkIn)}
                {r.distance != null && <>{showDate && ', '}{r.distance} m</>}
              </span>
              <span className="notes">
                {r.late > 0 && <span className="pill late">{r.late} dk geç</span>}
                {r.manual && <span className="pill">Manuel</span>}
                {r.edited && <span className="pill">Düzenlendi</span>}
              </span>
            </td>
            <td data-label="Vardiya">
              {r.shiftName ? <>{r.shiftName} <span className="dim block">{r.partTime ? 'saat serbest' : `${r.shiftStart}–${r.shiftEnd}`}{r.shiftAuto && ', en yakın'}</span></> : '—'}
            </td>
            <td data-label="Saat">
              {tFmt(r.checkIn)} – {r.checkOut ? tFmt(r.checkOut) : <span className="pill on">Mesaide</span>}
            </td>
            <td data-label="Süre">{durFmt(r.minutes)}</td>
            <td data-label="Hakediş">{r.payType === 'salary' && !Number(r.hourlyRate)
              ? <span className="dim">Maaşlı</span>
              : <><b>{money(r.earning)}</b><span className="dim block">{money(r.hourlyRate)}/sa</span></>}</td>
            <td className="act">
              {!r.checkOut && <button className="btn primary sm" onClick={() => openCheckout(r.id, r.staffName, r.checkIn)}>Çıkış yap</button>}
              <button className="btn sm" onClick={() => openRecord(r)}>Düzenle</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

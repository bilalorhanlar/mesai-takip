'use client';

import { dFmt, durFmt, money, tFmt } from '@/lib/format';
import { useAdmin } from './context';

// Kayıt tablosu (Şu An ve Kayıtlar sekmesinde ortak)
export default function RecordTable({ records, empty }) {
  const { openRecord, openCheckout } = useAdmin();
  if (!records.length) return <table className="tbl"><tbody><tr><td className="empty">{empty}</td></tr></tbody></table>;
  return (
    <table className="tbl">
      <thead>
        <tr><th>Tarih</th><th>Personel</th><th>Vardiya</th><th>Giriş</th><th>Çıkış</th><th>Süre</th><th>Hakediş</th><th>Not</th><th /></tr>
      </thead>
      <tbody>
        {records.map((r) => (
          <tr key={r.id}>
            <td>{dFmt(r.checkIn)}</td>
            <td><b>{r.staffName}</b></td>
            <td>
              {r.shiftName ? <>{r.shiftName} <span className="dim">{r.partTime ? 'saat serbest' : `${r.shiftStart}–${r.shiftEnd}`}</span></> : '—'}
              {r.shiftAuto && <span className="dim block">en yakın vardiya</span>}
            </td>
            <td>{tFmt(r.checkIn)}</td>
            <td>{r.checkOut ? tFmt(r.checkOut) : <span className="pill on">Mesaide</span>}</td>
            <td>{durFmt(r.minutes)}</td>
            <td>{r.payType === 'salary' && !Number(r.hourlyRate)
              ? <span className="dim">Maaşlı</span>
              : <><b>{money(r.earning)}</b><span className="dim block">{money(r.hourlyRate)}/sa</span></>}</td>
            <td>
              {r.late > 0 && <span className="pill late">{r.late} dk geç</span>}{' '}
              {r.manual && <span className="pill">Manuel</span>}{' '}
              {r.edited && <span className="pill">Düzenlendi</span>}{' '}
              {r.distance != null && <span className="dim">{r.distance} m</span>}
            </td>
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

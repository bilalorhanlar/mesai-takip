export const TZ = 'Europe/Istanbul';

export const tFmt = (iso) => (iso ? new Date(iso).toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '—');
export const dFmt = (iso) => new Date(iso).toLocaleDateString('tr-TR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
// 'YYYY-MM-DD' gün değeri (saat dilimi kaymasın diye UTC öğlen)
export const dayFmt = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('tr-TR', { timeZone: 'UTC', ...opts });
export const durFmt = (min) => (min == null ? '—' : `${Math.floor(min / 60)} sa ${min % 60} dk`);
export const hrsFmt = (min) => (min / 60).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
export const money = (v) => Number(v || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
export const num = (v) => Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const minsBetween = (a, b) => Math.max(0, Math.round(((b ? new Date(b) : new Date()) - new Date(a)) / 60000));
export const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
export const daysAgoStr = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() - n * 864e5));
export const monthStart = () => todayStr().slice(0, 8) + '01';
export const nextDay = (d) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
export const shiftLabel = (x) => (x ? `${x.name} (${x.start}–${x.end})` : '—');
export const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toLocaleUpperCase('tr-TR');

// <input type="datetime-local"> <-> ISO (Türkiye UTC+3)
export function toLocalInput(d) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
}
export const fromLocalInput = (v) => (v ? new Date(v + ':00+03:00').toISOString() : null);

// Excel uyumlu CSV (; ayraçlı, UTF-8 BOM), tarayıcıda oluşturulur
export function downloadCsv(name, rows) {
  const csv = '﻿' + rows.map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const DAY_SHORT = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz']; // ISO 1..7
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

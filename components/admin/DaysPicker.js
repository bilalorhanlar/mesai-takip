'use client';

import { DAY_SHORT } from '@/lib/format';

// Haftalık izin günleri (ISO 1=Pazartesi … 7=Pazar)
export default function DaysPicker({ value = [], onChange }) {
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <div className="days">
      {DAY_SHORT.map((label, i) => (
        <label key={label} className="day">
          <input type="checkbox" checked={value.includes(i + 1)} onChange={() => toggle(i + 1)} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { fromLocalInput, tFmt, toLocalInput } from '@/lib/format';
import { useAdmin } from './context';
import Dialog from './Dialog';

// Hızlı çıkış: saat değiştirilmezse "şimdi" kullanılır
export default function CheckoutDialog({ target, onClose }) {
  const { api, toast, afterChange } = useAdmin();
  const [initial] = useState(() => toLocalInput(new Date()));
  const [time, setTime] = useState(initial);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('admin_checkout', { p_record: target.id, p_time: time === initial ? null : fromLocalInput(time) });
      toast('Çıkış yapıldı'); onClose(); afterChange();
    } catch (err) { toast(err.message, false); }
  };

  return (
    <Dialog open onClose={onClose}>
      <form onSubmit={submit}>
        <h3>Mesai çıkışı</h3>
        <p>{target.name}, giriş saati {tFmt(target.checkIn)}</p>
        <label>Çıkış saati<input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} required /></label>
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={onClose}>Vazgeç</button>
          <button className="btn primary">Çıkışı yap</button>
        </div>
      </form>
    </Dialog>
  );
}

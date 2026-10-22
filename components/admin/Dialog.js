'use client';

import { useEffect, useRef } from 'react';

// Yerel <dialog> (Esc ve arka plan bulanıklığı tarayıcıdan)
export default function Dialog({ open, onClose, className = '', children }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={`dlg ${className}`} onClose={onClose}>
      {open && children}
    </dialog>
  );
}

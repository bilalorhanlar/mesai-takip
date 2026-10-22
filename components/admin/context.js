'use client';

import { createContext, useContext } from 'react';

// Panel genelinde paylaşılan: api, state (personel/vardiya/bugün), yeniden yükleme, bildirim, diyaloglar
export const AdminContext = createContext(null);
export const useAdmin = () => useContext(AdminContext);

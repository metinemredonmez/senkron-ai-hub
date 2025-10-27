'use client';

import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

const translations = {
  en: {
    dashboard: 'Dashboard',
    cases: 'Cases',
    quotes: 'Quotes',
    bookings: 'Bookings',
    itinerary: 'Itinerary',
    chat: 'AI Copilot',
    ops: 'Ops Console',
    approvals: 'Approvals',
    pending: 'Pending',
    nonDiagnostic: 'Non-diagnostic educational support only.',
  },
  tr: {
    dashboard: 'Gösterge Paneli',
    cases: 'Vaka Yönetimi',
    quotes: 'Teklifler',
    bookings: 'Rezervasyonlar',
    itinerary: 'Program',
    chat: 'Yapay Zeka Asistanı',
    ops: 'Operasyon Konsolu',
    approvals: 'Onaylar',
    pending: 'Beklemede',
    nonDiagnostic: 'Tıbbi tanı amacı taşımayan eğitimsel destek.',
  },
};

type Locale = keyof typeof translations;

interface I18nContextValue {
  locale: Locale;
  t: (key: keyof typeof translations.en) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => translations[locale][key],
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}

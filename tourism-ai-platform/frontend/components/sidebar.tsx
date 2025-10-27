'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { useI18n } from '../lib/i18n';
import { useFeatureFlags } from '../lib/feature-flags';
import { MessageCircle, ClipboardList, ClipboardCheck, Workflow, Home, Map, Megaphone, ListChecks } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  hidden?: boolean;
}

export function Sidebar() {
  const pathname = usePathname();
  const { t, setLocale, locale } = useI18n();
  const flags = useFeatureFlags();

  const items: NavItem[] = [
    { href: '/dashboard', label: t('dashboard'), icon: <Home className="h-5 w-5" /> },
    { href: '/cases', label: t('cases'), icon: <ClipboardList className="h-5 w-5" /> },
    { href: '/quotes', label: t('quotes'), icon: <ClipboardCheck className="h-5 w-5" /> },
    { href: '/bookings', label: t('bookings'), icon: <Map className="h-5 w-5" /> },
    { href: '/itinerary', label: t('itinerary'), icon: <Workflow className="h-5 w-5" /> },
    { href: '/chat', label: t('chat'), icon: <MessageCircle className="h-5 w-5" />, hidden: !flags.speech && !flags.personalization },
    { href: '/ops', label: t('ops'), icon: <ListChecks className="h-5 w-5" /> },
  ];

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white/70 p-4 backdrop-blur">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-lg font-semibold">Health Tourism AI</span>
        <select
          className="rounded border px-2 py-1 text-sm"
          value={locale}
          onChange={(event) => setLocale(event.target.value as 'en' | 'tr')}
        >
          <option value="en">EN</option>
          <option value="tr">TR</option>
        </select>
      </div>
      <nav className="flex-1 space-y-1">
        {items
          .filter((item) => !item.hidden)
          .map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                  active ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
      </nav>
      <div className="mt-6 rounded-md bg-slate-100 p-3 text-xs text-slate-600">
        <Megaphone className="mb-1 h-4 w-4" />
        KVKK/GDPR compliant. {t('nonDiagnostic')}
      </div>
    </aside>
  );
}

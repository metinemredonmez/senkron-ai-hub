'use client';

import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '../../components/sidebar';
import { fetchCases } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

export default function CasesPage() {
  const { data: cases = [] } = useQuery({ queryKey: ['cases'], queryFn: fetchCases });
  const { t } = useI18n();

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-800">{t('cases')}</h1>
          <a
            href="/cases/new"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            New intake
          </a>
        </div>
        <div className="mt-6 space-y-4">
          {cases.map((item) => (
            <article key={item.id} className="rounded-lg border bg-white p-6 shadow-sm">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{item.id}</p>
                  <h2 className="text-xl font-semibold text-slate-800">{item.patientName}</h2>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    item.status === 'awaiting-approval'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {item.status}
                </span>
              </header>
              <p className="mt-3 text-sm text-slate-600">
                {item.targetProcedure} &middot; Stage: {item.stage}
              </p>
              {item.redFlags.length > 0 && (
                <p className="mt-2 text-sm text-orange-600">Red flags: {item.redFlags.join(', ')}</p>
              )}
              <footer className="mt-4 text-xs text-slate-500">{item.disclaimer}</footer>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

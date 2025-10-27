'use client';

import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '../../components/sidebar';
import { fetchQuotes } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

export default function QuotesPage() {
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes'], queryFn: fetchQuotes });
  const { t } = useI18n();

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-2xl font-semibold text-slate-800">{t('quotes')}</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {quotes.map((quote) => (
            <div key={quote.caseId} className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">Case {quote.caseId}</h2>
              <p className="mt-2 text-2xl font-bold text-emerald-600">
                {quote.currency} {quote.total.toLocaleString()}
              </p>
              {quote.travel && (
                <p className="text-sm text-slate-500">Travel: {quote.currency} {quote.travel.toLocaleString()}</p>
              )}
              <p className="mt-3 text-xs text-slate-500">{quote.disclaimer}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

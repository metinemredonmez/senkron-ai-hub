'use client';

import { useQuery } from '@tanstack/react-query';
import { MetricCard } from '../../components/cards/metric-card';
import { fetchApprovals, fetchCases } from '../../lib/api';
import { CaseSummary } from '../../lib/types';
import { Sidebar } from '../../components/sidebar';
import { useI18n } from '../../lib/i18n';

export default function DashboardPage() {
  const { t } = useI18n();
  const { data: cases = [] } = useQuery({ queryKey: ['cases'], queryFn: fetchCases });
  const { data: approvals = [] } = useQuery({ queryKey: ['approvals'], queryFn: fetchApprovals });

  const quoteReady = cases.filter((item) => item.status === 'quote-ready').length;
  const awaitingApproval = approvals.filter((task) => task.status === 'PENDING').length;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-2xl font-semibold text-slate-800">{t('dashboard')}</h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard title={t('cases')} value={cases.length} description="Active patient journeys" />
          <MetricCard title={t('quotes')} value={quoteReady} description="Quote ready" />
          <MetricCard title={t('approvals')} value={awaitingApproval} description={t('pending')} />
          <MetricCard title="Red flags" value={countRedFlags(cases)} description="Needs clinical review" />
        </div>
        <section className="mt-8 rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Latest Cases</h2>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2">Case</th>
                <th className="py-2">Procedure</th>
                <th className="py-2">Stage</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cases.slice(0, 5).map((item) => (
                <tr key={item.id} className="text-slate-700">
                  <td className="py-2 font-medium">{item.patientName}</td>
                  <td className="py-2">{item.targetProcedure}</td>
                  <td className="py-2 capitalize">{item.stage}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        item.status === 'awaiting-approval'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

function countRedFlags(cases: CaseSummary[]): number {
  return cases.reduce((total, item) => total + item.redFlags.length, 0);
}

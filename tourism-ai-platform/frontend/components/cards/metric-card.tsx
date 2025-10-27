'use client';

import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: ReactNode;
  description?: string;
}

export function MetricCard({ title, value, description }: MetricCardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
    </div>
  );
}

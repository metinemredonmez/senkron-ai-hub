'use client';

import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '../../components/sidebar';
import { fetchApprovals } from '../../lib/api';
import { ApprovalQueue } from '../../components/ops/approval-queue';

export default function OpsConsolePage() {
  const { data: approvals = [] } = useQuery({ queryKey: ['approvals'], queryFn: fetchApprovals });

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-2xl font-semibold text-slate-800">Ops Console</h1>
        <p className="mt-2 text-sm text-slate-600">
          Approval tasks triggered by orchestrator red flags are listed below.
        </p>
        <div className="mt-6">
          <ApprovalQueue tasks={approvals} />
        </div>
      </main>
    </div>
  );
}

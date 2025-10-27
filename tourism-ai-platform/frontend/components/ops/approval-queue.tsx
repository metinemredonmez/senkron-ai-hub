'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveTask } from '../../lib/api';
import { ApprovalTask } from '../../lib/types';

interface Props {
  tasks: ApprovalTask[];
}

export function ApprovalQueue({ tasks }: Props) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (taskId: string) => approveTask(taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approvals'] }),
  });

  if (tasks.length === 0) {
    return <p className="text-sm text-slate-500">No approval tasks pending.</p>;
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <div key={task.id} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Case {task.caseId}</p>
              <p className="text-xs text-slate-500">Flags: {task.flags.join(', ')}</p>
            </div>
            <button
              onClick={() => mutation.mutate(task.id)}
              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

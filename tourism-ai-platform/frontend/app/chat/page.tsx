'use client';

import { Sidebar } from '../../components/sidebar';
import { ChatPanel } from '../../components/chat/chat-panel';
import { useFeatureFlags } from '../../lib/feature-flags';

export default function ChatPage() {
  const flags = useFeatureFlags();
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-800">AI Copilot</h1>
          <div className="text-xs text-slate-500">
            {flags.personalization ? 'Personalization enabled' : 'Journeys using default heuristics'}
          </div>
        </div>
        <div className="mt-6 h-[80vh]">
          <ChatPanel />
        </div>
      </main>
    </div>
  );
}

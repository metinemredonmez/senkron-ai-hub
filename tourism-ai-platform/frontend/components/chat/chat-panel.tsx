'use client';

import { FormEvent, useEffect, useState } from 'react';
import { fetchChatHistory } from '../../lib/api';
import { ChatMessage } from '../../lib/types';
import { useFeatureFlags } from '../../lib/feature-flags';

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const flags = useFeatureFlags();

  useEffect(() => {
    fetchChatHistory().then(setMessages);
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    const userMessage: ChatMessage = { role: 'user', content: input };
    const assistant: ChatMessage = {
      role: 'assistant',
      content: 'Referencing latest treatment packages and travel logistics.',
      citations: [
        {
          id: 'source-1',
          snippet: 'Package includes hospital + 7 night hotel stay.',
          source: 'RAG:packages/istanbul-rhinoplasty.md',
        },
      ],
    };
    setMessages((prev) => [...prev, userMessage, assistant]);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border bg-white p-4 shadow-sm">
        {messages.map((message, index) => (
          <div key={index} className={`rounded-lg p-3 ${message.role === 'assistant' ? 'bg-emerald-50' : 'bg-slate-100'}`}>
            <p className="text-sm text-slate-700">{message.content}</p>
            {message.citations && (
              <ul className="mt-2 space-y-1 text-xs text-emerald-700">
                {message.citations.map((citation) => (
                  <li key={citation.id} className="border-l-2 border-emerald-400 pl-2">
                    {citation.snippet} — <span className="underline">{citation.source}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit} className="mt-4 flex gap-3">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about packages, logistics, or aftercare..."
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white">Send</button>
        {flags.speech && (
          <button type="button" className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700">
            Voice
          </button>
        )}
      </form>
    </div>
  );
}

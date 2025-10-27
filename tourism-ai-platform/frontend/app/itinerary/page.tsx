'use client';

import { Sidebar } from '../../components/sidebar';

const SAMPLE_ITINERARY = [
  {
    id: 'event-1',
    title: 'Arrival & hotel check-in',
    date: '2025-02-01T12:00:00Z',
  },
  {
    id: 'event-2',
    title: 'Pre-operative consultation',
    date: '2025-02-02T09:00:00Z',
  },
  {
    id: 'event-3',
    title: 'Surgery & recovery',
    date: '2025-02-03T08:00:00Z',
  },
];

export default function ItineraryPage() {
  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-2xl font-semibold text-slate-800">Itinerary</h1>
        <p className="mt-2 text-sm text-slate-600">
          Generated itinerary includes PDF and ICS exports delivered via secure presigned URLs.
        </p>
        <div className="mt-6 space-y-3">
          {SAMPLE_ITINERARY.map((event) => (
            <div key={event.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">{new Date(event.date).toLocaleString()}</p>
              <h2 className="text-lg font-semibold text-slate-800">{event.title}</h2>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <a
            href="http://localhost:4000/api/itinerary.pdf"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Download PDF
          </a>
          <a
            href="http://localhost:4000/api/itinerary.ics"
            className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700"
          >
            Download ICS
          </a>
        </div>
      </main>
    </div>
  );
}

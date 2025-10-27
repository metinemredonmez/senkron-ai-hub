'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('App error boundary', error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-lg bg-white p-6 text-center shadow">
          <h1 className="text-lg font-semibold text-slate-800">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">Our team has been notified. Try again shortly.</p>
          <button
            onClick={reset}
            className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}

import './globals.css';
import { AppProviders } from '../components/providers';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Health Tourism AI Platform',
  description: 'Coordinating health tourism journeys end-to-end with AI orchestration.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

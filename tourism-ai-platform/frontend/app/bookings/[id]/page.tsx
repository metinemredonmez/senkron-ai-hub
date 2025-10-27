import type { Metadata } from 'next';

interface BookingPageProps {
  params: {
    id: string;
  };
}

export const metadata: Metadata = {
  title: 'Booking Details',
};

export default function BookingPage({ params }: BookingPageProps) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Booking #{params.id}</h1>
        <p className="text-sm text-muted-foreground">
          Detailed booking information will appear here after the integration is completed.
        </p>
      </header>
      <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          This placeholder keeps routing intact while the Doktor365 integration delivers booking
          metadata. Update this page with the finalized UI once the backend endpoints are ready.
        </p>
      </article>
    </section>
  );
}

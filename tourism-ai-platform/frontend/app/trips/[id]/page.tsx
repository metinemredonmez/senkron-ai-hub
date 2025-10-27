import type { Metadata } from 'next';

interface TripPageProps {
  params: {
    id: string;
  };
}

export const metadata: Metadata = {
  title: 'Trip Details',
};

export default function TripPage({ params }: TripPageProps) {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Trip #{params.id}</h1>
        <p className="text-sm text-muted-foreground">
          Trip itinerary information will be rendered here once the travel orchestration API is ready.
        </p>
      </header>
      <article className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          This scaffold keeps navigation stable while we complete the Doktor365 travel scheduling
          integration. Replace it with real content when the endpoints and UI specs are finalized.
        </p>
      </article>
    </section>
  );
}

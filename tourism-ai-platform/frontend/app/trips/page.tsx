import Link from 'next/link';

export default function TripsPage() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Patient Trips</h1>
        <p className="text-sm text-muted-foreground">
          Travel itineraries coordinated through Doktor365 will appear here once synchronization is
          complete.
        </p>
      </header>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          We&apos;re still pulling itinerary data from the backend. Check back soon for a detailed
          view of transfers, accommodations, and appointments, or jump straight to a known trip.
        </p>
        <div className="mt-4 inline-flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">Try a direct link:</span>
          <Link className="font-medium text-primary underline" href="/trips/sample-trip">
            /trips/sample-trip
          </Link>
        </div>
      </div>
    </section>
  );
}

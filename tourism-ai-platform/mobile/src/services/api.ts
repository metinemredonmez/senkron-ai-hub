const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface TripSummary {
  caseId: string;
  destination: string;
  travelDate: string;
  status: string;
}

export interface BookingSummary {
  id: string;
  status: string;
  paymentStatus: string;
}

export async function fetchTrips(): Promise<TripSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/travel/trips`);
    if (!res.ok) throw new Error('Request failed');
    return await res.json();
  } catch (error) {
    console.warn('Trips fallback', error);
    return [
      {
        caseId: 'case-001',
        destination: 'Istanbul',
        travelDate: new Date().toISOString(),
        status: 'Confirmed',
      },
    ];
  }
}

export async function fetchMobileBookings(): Promise<BookingSummary[]> {
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    if (!res.ok) throw new Error('Request failed');
    return await res.json();
  } catch (error) {
    console.warn('Bookings fallback', error);
    return [
      {
        id: 'booking-001',
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      },
    ];
  }
}

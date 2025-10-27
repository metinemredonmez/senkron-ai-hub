'use client';

import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '../../components/sidebar';
import { fetchBookings } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

export default function BookingsPage() {
  const { data: bookings = [] } = useQuery({ queryKey: ['bookings'], queryFn: fetchBookings });
  const { t } = useI18n();

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <h1 className="text-2xl font-semibold text-slate-800">{t('bookings')}</h1>
        <table className="mt-6 w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-2">Booking</th>
              <th className="py-2">Case</th>
              <th className="py-2">Status</th>
              <th className="py-2">Payment</th>
              <th className="py-2">Travel</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {bookings.map((booking) => (
              <tr key={booking.id} className="text-slate-700">
                <td className="py-3 font-medium">{booking.id}</td>
                <td className="py-3">{booking.caseId}</td>
                <td className="py-3">{booking.status}</td>
                <td className="py-3">{booking.paymentStatus}</td>
                <td className="py-3">{new Date(booking.travelDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}

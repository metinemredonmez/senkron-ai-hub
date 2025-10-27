import { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { fetchMobileBookings, BookingSummary } from '../services/api';

export function BookingsScreen() {
  const [bookings, setBookings] = useState<BookingSummary[]>([]);

  useEffect(() => {
    fetchMobileBookings().then(setBookings);
  }, []);

  return (
    <FlatList
      data={bookings}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      renderItem={({ item }) => (
        <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, shadowOpacity: 0.1 }}>
          <Text style={{ fontSize: 14, color: '#64748b' }}>Booking {item.id}</Text>
          <Text style={{ marginTop: 4, color: '#0f172a', fontWeight: '500' }}>Status: {item.status}</Text>
          <Text style={{ marginTop: 4, color: '#0f172a' }}>Payment: {item.paymentStatus}</Text>
        </View>
      )}
    />
  );
}

import { useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl } from 'react-native';
import { fetchTrips, TripSummary } from '../services/api';

export function TripsScreen() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    setTrips(await fetchTrips());
    setRefreshing(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <FlatList
      data={trips}
      keyExtractor={(item) => item.caseId}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      renderItem={({ item }) => (
        <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, shadowOpacity: 0.1 }}>
          <Text style={{ fontSize: 14, color: '#64748b' }}>Case {item.caseId}</Text>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#0f172a', marginTop: 4 }}>{item.destination}</Text>
          <Text style={{ marginTop: 4, color: '#475569' }}>{new Date(item.travelDate).toLocaleDateString()}</Text>
          <Text style={{ marginTop: 4, color: '#047857', fontWeight: '500' }}>{item.status}</Text>
        </View>
      )}
    />
  );
}

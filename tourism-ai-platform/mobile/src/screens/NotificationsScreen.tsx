import { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
}

const SAMPLE_ALERTS: NotificationItem[] = [
  {
    id: 'alert-1',
    title: 'Approval Required',
    message: 'Clinical ops must approve Case 002 before itinerary continues.',
  },
  {
    id: 'alert-2',
    title: 'Visa document uploaded',
    message: 'Passport scan received for Case 003.',
  },
];

export function NotificationsScreen() {
  const [alerts, setAlerts] = useState<NotificationItem[]>([]);

  useEffect(() => {
    setAlerts(SAMPLE_ALERTS);
  }, []);

  return (
    <FlatList
      data={alerts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      renderItem={({ item }) => (
        <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 12, shadowOpacity: 0.1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#0f172a' }}>{item.title}</Text>
          <Text style={{ marginTop: 4, color: '#475569' }}>{item.message}</Text>
        </View>
      )}
    />
  );
}

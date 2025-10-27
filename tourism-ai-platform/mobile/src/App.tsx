import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { TripsScreen } from './screens/TripsScreen';
import { BookingsScreen } from './screens/BookingsScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer theme={AppTheme}>
      <StatusBar style="dark" />
      <Tab.Navigator
        initialRouteName="Trips"
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
              Trips: 'airplane-outline',
              Bookings: 'calendar-outline',
              Alerts: 'notifications-outline',
            };
            return <Ionicons name={iconMap[route.name] ?? 'ellipse-outline'} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#047857',
          tabBarInactiveTintColor: '#94a3b8',
          headerShown: false,
        })}
      >
        <Tab.Screen name="Trips" component={TripsScreen} />
        <Tab.Screen name="Bookings" component={BookingsScreen} />
        <Tab.Screen name="Alerts" component={NotificationsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f8fafc',
  },
};

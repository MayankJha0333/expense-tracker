import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ActivityIndicator, View } from 'react-native';

import { Txt } from '../../components/ui';
import { useStore } from '../../lib/store';
import { fonts, usePalette } from '../../theme';

export default function TabsLayout() {
  const p = usePalette();
  const { status } = useStore();

  if (status === 'needs_permission') return <Redirect href="/welcome" />;

  if (status === 'booting' || status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <ActivityIndicator color={p.marigold} size="large" />
        <Txt variant="small" color={p.muted}>
          {status === 'loading' ? 'Reading your bank messages…' : ' '}
        </Txt>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: p.bg },
        tabBarActiveTintColor: p.ink,
        tabBarInactiveTintColor: p.muted,
        tabBarStyle: { backgroundColor: p.bg, borderTopColor: p.line },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="format-list-bulleted" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="chart-box-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}

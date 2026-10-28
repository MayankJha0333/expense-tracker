import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { LogoTile } from '../../components/Logo';
import { Txt } from '../../components/ui';
import { useStore } from '../../lib/store';
import type { IconName } from '../../lib/types';
import { usePalette } from '../../theme';

const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-variant-outline', 'home-variant'],
  activity: ['format-list-bulleted', 'format-list-bulleted-square'],
  insights: ['chart-box-outline', 'chart-box'],
  accounts: ['credit-card-outline', 'credit-card'],
};

/** Home · Activity · [+] · Insights · Accounts. The middle button adds a cash expense or income. */
function KharchaTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const p = usePalette();
  const items = state.routes.map((route, index) => {
    const focused = index === state.index;
    const { options } = descriptors[route.key];
    const label = typeof options.title === 'string' ? options.title : route.name;
    const [off, on] = TAB_ICONS[route.name] ?? ['circle-outline', 'circle'];
    const color = focused ? p.accentInk : p.muted;
    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        Haptics.selectionAsync().catch(() => {});
        navigateToTab(route.key);
      }
    };
    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={styles.tab}
      >
        <MaterialCommunityIcons name={focused ? on : off} size={24} color={color} />
        <Txt variant="tiny" color={color} style={focused ? { fontFamily: 'Sora_600SemiBold' } : undefined}>
          {label}
        </Txt>
      </Pressable>
    );
  });

  const add = (
    <View key="add" style={styles.tab}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/add');
        }}
        accessibilityRole="button"
        accessibilityLabel="Add a cash expense or income"
        style={({ pressed }) => [styles.add, { backgroundColor: p.fab, boxShadow: p.shadowRaised, opacity: pressed ? 0.85 : 1 }]}
      >
        <MaterialCommunityIcons name="plus" size={28} color={p.onFab} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.bar, { backgroundColor: p.bg, borderTopColor: p.line, paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {items.slice(0, 2)}
      {add}
      {items.slice(2)}
    </View>
  );
}

export default function TabsLayout() {
  const p = usePalette();
  const { status } = useStore();

  if (status === 'onboarding') return <Redirect href="/welcome" />;

  if (status === 'booting' || status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <LogoTile size={72} />
        <ActivityIndicator color={p.accent} />
        <Txt variant="small" color={p.muted}>
          {status === 'loading' ? 'Reading bank messages on this phone…' : ' '}
        </Txt>
      </View>
    );
  }

  return (
    <Tabs tabBar={(props) => <KharchaTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: p.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, minHeight: 52 },
  add: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: -6 },
});

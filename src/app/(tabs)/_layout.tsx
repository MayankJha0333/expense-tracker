import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { CurrencyScope } from '../../components/CurrencyScope';
import { LogoTile } from '../../components/Logo';
import { Appear, PressScale } from '../../components/motion';
import { Txt } from '../../components/ui';
import { MOTION, SPRING } from '../../lib/motion';
import { useStore } from '../../lib/store';
import type { IconName } from '../../lib/types';
import { usePalette } from '../../theme';

const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index: ['home-variant-outline', 'home-variant'],
  activity: ['format-list-bulleted', 'format-list-bulleted-square'],
  insights: ['chart-box-outline', 'chart-box'],
  accounts: ['credit-card-outline', 'credit-card'],
};

/** One tab: a soft pill grows behind the icon when it becomes active, and the icon lifts a little. */
function TabItem({ focused, icon, label, onPress }: { focused: boolean; icon: IconName; label: string; onPress: () => void }) {
  const p = usePalette();
  const reduced = useReducedMotion();
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.set(reduced ? (focused ? 1 : 0) : focused ? withSpring(1, SPRING) : withTiming(0, { duration: MOTION.fast }));
  }, [focused, reduced, on]);
  const pill = useAnimatedStyle(() => ({ opacity: on.get(), transform: [{ scaleX: 0.55 + 0.45 * on.get() }] }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -1.5 * on.get() }, { scale: 1 + 0.06 * on.get() }] }));
  const color = focused ? p.accentInk : p.muted;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} style={styles.tab}>
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.pill, { backgroundColor: p.accentSoft }, pill]} />
        <Animated.View style={lift}>
          <MaterialCommunityIcons name={icon} size={24} color={color} />
        </Animated.View>
      </View>
      <Txt variant="tiny" color={color} style={focused ? { fontFamily: 'Sora_600SemiBold' } : undefined}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Home · Activity · [+] · Insights · Accounts. The middle button adds a cash expense or income. */
function KharchaTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const p = usePalette();
  const items = state.routes.map((route, index) => {
    const focused = index === state.index;
    const { options } = descriptors[route.key];
    const label = typeof options.title === 'string' ? options.title : route.name;
    const [off, on] = TAB_ICONS[route.name] ?? ['circle-outline', 'circle'];
    const onPress = () => {
      const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        Haptics.selectionAsync().catch(() => {});
        navigateToTab(route.key);
      }
    };
    return <TabItem key={route.key} focused={focused} icon={focused ? on : off} label={label} onPress={onPress} />;
  });

  const add = (
    <View key="add" style={styles.tab}>
      <PressScale
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/add');
        }}
        scaleTo={0.88}
        accessibilityRole="button"
        accessibilityLabel="Add a cash expense or income"
        style={[styles.add, { backgroundColor: p.fab, boxShadow: p.shadowRaised }]}
      >
        <MaterialCommunityIcons name="plus" size={28} color={p.onFab} />
      </PressScale>
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
  const reduced = useReducedMotion();

  if (status === 'onboarding') return <Redirect href="/welcome" />;

  if (status === 'booting' || status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <Appear>
          <LogoTile size={72} />
        </Appear>
        <ActivityIndicator color={p.accent} />
        <Txt variant="small" color={p.muted}>
          {status === 'loading' ? 'Reading bank messages on this phone…' : ' '}
        </Txt>
      </View>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <KharchaTabBar {...props} />}
      screenLayout={({ children }) => <CurrencyScope>{children}</CurrencyScope>}
      // Switching tabs: the new screen shifts in a little and fades (turned off by "Reduce motion").
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: p.bg }, animation: reduced ? 'none' : 'shift' }}
    >
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
  iconWrap: { width: 56, height: 30, alignItems: 'center', justifyContent: 'center' },
  pill: { position: 'absolute', width: 56, height: 30, borderRadius: 15 },
  add: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', marginTop: -6 },
});

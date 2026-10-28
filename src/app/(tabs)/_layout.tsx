import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { CurrencyScope } from '../../components/CurrencyScope';
import { LogoTile } from '../../components/Logo';
import { Appear, PressScale } from '../../components/motion';
import { TAB_BAR, tabBarBottom } from '../../components/tabBarSpace';
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

/** One tab: icon over a short label. The sliding highlight behind it is drawn by the bar. */
function TabItem({ focused, icon, label, onPress }: { focused: boolean; icon: IconName; label: string; onPress: () => void }) {
  const p = usePalette();
  const reduced = useReducedMotion();
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.set(reduced ? (focused ? 1 : 0) : focused ? withSpring(1, SPRING) : withTiming(0, { duration: MOTION.fast }));
  }, [focused, reduced, on]);
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -1 * on.get() }, { scale: 1 + 0.06 * on.get() }] }));
  const color = focused ? p.accentInk : p.muted;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label} style={styles.tab}>
      <Animated.View style={lift}>
        <MaterialCommunityIcons name={icon} size={23} color={color} />
      </Animated.View>
      <Txt variant="tiny" color={color} numberOfLines={1} style={focused ? { fontFamily: 'Sora_600SemiBold' } : undefined}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** "#RRGGBB" → the same colour fully see-through, for the fade under the bar. */
const clear = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}00` : 'transparent');

/**
 * Floating tab bar: Home · Activity · [+] · Insights · Accounts in a rounded pill that sits
 * above the bottom edge. One soft highlight slides to the open tab. The middle button adds a
 * cash expense or income. A short fade under the pill keeps scrolled content from cutting
 * hard against it.
 */
function KharchaTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const p = usePalette();
  const reduced = useReducedMotion();
  const bottom = tabBarBottom(insets.bottom);

  // Five equal slots: tab, tab, +, tab, tab. The highlight moves between the tab slots.
  const [width, setWidth] = useState(0);
  const slot = width > 0 ? (width - TAB_BAR.pad * 2) / 5 : 0;
  const slotIndex = state.index < 2 ? state.index : state.index + 1;
  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!slot) return;
    const to = slotIndex * slot;
    if (!placed.current || reduced) {
      placed.current = true;
      x.set(to);
    } else {
      x.set(withSpring(to, SPRING));
    }
  }, [slot, slotIndex, reduced, x]);
  const highlight = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

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

  // The middle slot stays empty in the bar; the + button floats above it as its own layer,
  // so the part that sticks out above the pill still takes taps on Android.
  const gap = <View key="add-slot" style={styles.tab} />;

  return (
    <>
      <View
        pointerEvents="none"
        style={[styles.fade, { height: bottom + TAB_BAR.height + 40, backgroundImage: `linear-gradient(to bottom, ${clear(p.bg)}, ${p.bg} 62%)` }]}
      />
      <View
        accessibilityRole="tablist"
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.bar, { bottom, backgroundColor: p.surface, borderColor: p.line, boxShadow: p.shadowFloat }]}
      >
        {slot > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.highlight, { width: slot, backgroundColor: p.accentSoft }, highlight]} />
        ) : null}
        {items.slice(0, 2)}
        {gap}
        {items.slice(2)}
      </View>
      {/* Raised + button: centred on the bar, lifted so it pops out above the pill. */}
      <View pointerEvents="box-none" style={[styles.addLayer, { bottom: bottom + (TAB_BAR.height - ADD_SIZE) / 2 + ADD_RAISE }]}>
        <PressScale
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push('/add');
          }}
          scaleTo={0.88}
          accessibilityRole="button"
          accessibilityLabel="Add a cash expense or income"
          hitSlop={6}
          style={[styles.add, { backgroundColor: p.fab, borderColor: p.surface, boxShadow: p.shadowRaised }]}
        >
          <MaterialCommunityIcons name="plus" size={30} color={p.onFab} />
        </PressScale>
      </View>
    </>
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

/** The raised + button: its size, and how far it lifts above the middle of the bar. */
const ADD_SIZE = 62;
const ADD_RAISE = 22;

const styles = StyleSheet.create({
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    position: 'absolute',
    left: TAB_BAR.side,
    right: TAB_BAR.side,
    height: TAB_BAR.height,
    borderRadius: TAB_BAR.height / 2,
    borderWidth: StyleSheet.hairlineWidth,
    padding: TAB_BAR.pad,
    flexDirection: 'row',
    alignItems: 'center',
  },
  highlight: { position: 'absolute', top: TAB_BAR.pad, bottom: TAB_BAR.pad, left: TAB_BAR.pad, borderRadius: (TAB_BAR.height - TAB_BAR.pad * 2) / 2 },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
  addLayer: { position: 'absolute', left: 0, right: 0, height: ADD_SIZE, alignItems: 'center' },
  add: { width: ADD_SIZE, height: ADD_SIZE, borderRadius: ADD_SIZE / 2, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
});

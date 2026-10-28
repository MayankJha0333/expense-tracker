import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, ReduceMotion, ZoomIn } from 'react-native-reanimated';

import { MOTION } from '../lib/motion';
import { radius, space, usePalette } from '../theme';
import { PressScale } from './motion';

// The ring settles into the corner and the orb pops in after it. Once, when the card first shows.
const ringIn = ZoomIn.duration(MOTION.fill).easing(Easing.out(Easing.cubic)).withInitialValues({ transform: [{ scale: 0.55 }] }).reduceMotion(ReduceMotion.System);
const orbIn = ZoomIn.delay(260).springify().damping(12).stiffness(220).reduceMotion(ReduceMotion.System);

/**
 * The big coloured card at the top of a screen (design 4a).
 * - Fill: the family colour (Midnight bright / Electric primary).
 * - A decorative ring in the top-right corner, plus a small orb in Electric.
 * - A soft shadow in the card's own colour, so it lifts off the page.
 * The shadow sits on the outer view and the ring is clipped by the inner one,
 * because clipping and shadows can't live on the same view.
 */
export function HeroCard({
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const body = (
    <View style={[styles.clip, { backgroundColor: p.hero }]}>
      <Animated.View entering={ringIn} pointerEvents="none" style={[styles.ring, { borderColor: p.heroRing }]} />
      {p.heroOrb !== 'transparent' ? <Animated.View entering={orbIn} pointerEvents="none" style={[styles.orb, { backgroundColor: p.heroOrb }]} /> : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
  const shadow = [styles.outer, { boxShadow: p.shadowHero }, style];
  if (!onPress) {
    return (
      <View style={shadow} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <PressScale onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={shadow}>
      {body}
    </PressScale>
  );
}

const RING = 168;

const styles = StyleSheet.create({
  outer: { borderRadius: radius.lg },
  clip: { borderRadius: radius.lg, overflow: 'hidden' },
  ring: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 26,
    right: -48,
    top: -52,
  },
  orb: { position: 'absolute', width: 26, height: 26, borderRadius: 13, right: 30, top: 26 },
  content: { padding: space.xl - 2, gap: space.md },
});

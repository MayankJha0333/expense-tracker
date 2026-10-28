/*
 * Building blocks for motion (Reanimated, runs on the UI thread):
 * - <Appear>        fades + rises into place when it first shows, one after another with `index`
 * - <PressScale>    a Pressable that dips a little when pressed and springs back
 * - useFill()       a 0..1 value that animates when the target changes (bars, rings)
 * All of them respect the phone's "Reduce motion" setting.
 */
import { Children, isValidElement, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { MOTION, SPRING, staggerDelay } from '../lib/motion';
import { space } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Entering animation for the n-th block on a screen. */
export const enterUp = (index = 0) =>
  FadeInDown.duration(MOTION.base)
    .delay(staggerDelay(index))
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ opacity: 0, transform: [{ translateY: MOTION.rise }] })
    .reduceMotion(ReduceMotion.System);

/** Plain crossfade, for content that swaps in place (month change, filter change). */
export const enterFade = FadeIn.duration(MOTION.fast).reduceMotion(ReduceMotion.System);

/** Fades and rises into place when it first mounts. Pass `index` to arrive after the blocks above it. */
export function Appear({ index = 0, style, children }: { index?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <Animated.View entering={enterUp(index)} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * A Pressable that dips to 97% while pressed and springs back on release.
 * Use for cards and big buttons; small icon buttons can keep a plain opacity change.
 */
export function PressScale({
  style,
  scaleTo = MOTION.pressScale,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; scaleTo?: number; children?: ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!reduced && !disabled) scale.set(withTiming(scaleTo, { duration: MOTION.press, easing: Easing.out(Easing.quad) }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(reduced ? 1 : withSpring(1, SPRING));
        onPressOut?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

/**
 * A 0..1 shared value that follows [target] smoothly. Starts from 0 on first show,
 * so bars and rings fill in. `delay` staggers several of them.
 */
export function useFill(target: number, delay = 0): SharedValue<number> {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? target : 0);
  const first = useRef(true);
  useEffect(() => {
    // Only the first fill waits for its turn; later changes respond at once.
    const wait = first.current ? delay : 0;
    first.current = false;
    v.set(
      reduced
        ? target
        : withDelay(wait, withTiming(target, { duration: MOTION.fill, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System })),
    );
  }, [target, reduced, delay, v]);
  return v;
}

/**
 * Wraps each child in <Appear> with a growing index, so a screen's sections arrive
 * one after another. Children that render nothing (false / null) are skipped, so
 * conditional sections never leave empty gaps. Returns a fragment: the parent's gap still applies.
 */
export function Stagger({ children, start = 0, gap = space.xl }: { children: ReactNode; start?: number; gap?: number }) {
  return (
    <>
      {Children.toArray(children).map((child, i) => (
        // `gap` keeps the page's spacing when a child is a fragment of several sections.
        <Appear key={isValidElement(child) && child.key != null ? child.key : i} index={start + i} style={{ gap }}>
          {child}
        </Appear>
      ))}
    </>
  );
}
